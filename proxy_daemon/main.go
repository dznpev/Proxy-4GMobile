package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

var customResolver = &net.Resolver{
	PreferGo: true,
	Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
		d := net.Dialer{Timeout: 4 * time.Second}
		// Android không có /etc/resolv.conf tiêu chuẩn khi build cgo=0.
		// Trỏ trực tiếp tới DNS Public chất lượng cao (Google, Cloudflare, Quad9).
		dnsServers := []string{
			"8.8.8.8:53",
			"1.1.1.1:53",
			"8.8.4.4:53",
			"9.9.9.9:53",
		}
		for _, server := range dnsServers {
			conn, err := d.DialContext(ctx, "udp", server)
			if err == nil {
				return conn, nil
			}
		}
		return d.DialContext(ctx, network, address)
	},
}

func handleTunneling(w http.ResponseWriter, r *http.Request) {
	dialer := &net.Dialer{
		Timeout:  10 * time.Second,
		Resolver: customResolver,
	}

	destConn, err := dialer.Dial("tcp", r.Host)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	defer destConn.Close()

	hijacker, ok := w.(http.Hijacker)
	if !ok {
		http.Error(w, "Hijacking not supported", http.StatusInternalServerError)
		return
	}

	clientConn, _, err := hijacker.Hijack()
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	defer clientConn.Close()

	clientConn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))

	go io.Copy(destConn, clientConn)
	io.Copy(clientConn, destConn)
}

func handleHTTP(w http.ResponseWriter, r *http.Request) {
	r.RequestURI = ""
	r.Header.Del("Proxy-Connection")

	transport := &http.Transport{
		Proxy: nil,
		DialContext: (&net.Dialer{
			Timeout:   10 * time.Second,
			KeepAlive: 30 * time.Second,
			Resolver:  customResolver,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}

	resp, err := transport.RoundTrip(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusServiceUnavailable)
		return
	}
	defer resp.Body.Close()

	for k, vv := range resp.Header {
		for _, v := range vv {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

func main() {
	port := flag.Int("port", 8080, "Port to listen on")
	flag.Parse()

	// Gán resolver mặc định cho toàn bộ package net
	net.DefaultResolver = customResolver

	server := &http.Server{
		Addr: fmt.Sprintf("0.0.0.0:%d", *port),
		Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodConnect {
				handleTunneling(w, r)
			} else {
				handleHTTP(w, r)
			}
		}),
	}

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-sigChan
		_ = server.Close()
		os.Exit(0)
	}()

	log.Printf("Android Native Go Proxy listening on :%d\n", *port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server error: %v", err)
	}
}
