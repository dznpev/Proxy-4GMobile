import { Icon } from '../components/Icon';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { useDashboard } from '../app/providers/DashboardProvider';
import { DEVICE_STATUS_LABELS } from '../lib/constants';
import { formatClock, formatDuration } from '../lib/format';
import { deviceTone } from '../lib/status';

export function DevicePage() {
  const {
    status,
    now,
    reconnecting,
    restarting,
    togglingCharging,
    reconnectDevice,
    restartProxy,
    setDeviceCharging,
  } = useDashboard();

  const app = status?.app;
  const device = status?.device;
  const proxy = status?.proxy;
  const battery = device?.battery;
  const rotationRunning = Boolean(status?.rotation?.running);

  const tone = deviceTone(device);
  const label = DEVICE_STATUS_LABELS[device?.status ?? ''] || 'Chưa kết nối';
  const badgeIcon =
    tone === 'success' ? 'check' : tone === 'info' ? 'refresh' : tone === 'danger' ? 'alert' : 'phone';

  const batteryTone =
    battery?.warning_level === 'danger'
      ? 'danger'
      : battery?.warning_level === 'warning'
        ? 'warning'
        : 'success';

  const batteryStatusLabels: Record<string, string> = {
    charging: 'Đang sạc',
    discharging: 'Đang xả pin',
    not_charging: 'Không sạc',
    full: 'Pin đầy',
    unknown: 'Không xác định',
  };

  const batteryPluggedLabels: Record<string, string> = {
    usb: 'Cổng USB máy tính',
    ac: 'Bộ sạc tường (AC)',
    wireless: 'Sạc không dây',
    none: 'Không cắm sạc',
  };

  const batteryHealthLabels: Record<string, string> = {
    good: 'Tốt (Bình thường)',
    overheat: 'Quá nhiệt',
    dead: 'Pin hỏng',
    over_voltage: 'Quá áp',
    cold: 'Quá lạnh',
  };

  let adbLabel = DEVICE_STATUS_LABELS[device?.status ?? ''] || 'Chưa kết nối';
  if (device?.status === 'ready') adbLabel = 'Đã kết nối · USB';
  if (device?.status === 'adb-missing' || app?.adb_available === false) {
    adbLabel = 'Không tìm thấy ADB';
  }

  const hasError = Boolean(device?.error) && device?.status !== 'ready';

  const reconnectDisabled =
    !device?.serial || device?.status === 'preparing' || rotationRunning || reconnecting;
  const reconnectTitle = rotationRunning
    ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
    : reconnectDisabled
      ? 'Cần phát hiện thiết bị trước khi kết nối lại.'
      : '';

  const restartDisabled =
    !device?.connected || device?.status === 'preparing' || rotationRunning || restarting;
  const restartTitle = rotationRunning
    ? 'Đang xoay IP, vui lòng chờ hoàn tất.'
    : restartDisabled
      ? 'Cần thiết bị đang kết nối để khởi động lại daemon.'
      : '';

  return (
    <section className="page" data-page="device" aria-labelledby="device-page-title">
      <div className="page-lead">
        <div>
          <h2 className="page-section-title" id="device-page-title">
            Thiết bị Android
          </h2>
          <p className="page-lead-text">
            Kiểm tra kết nối ADB, daemon proxy và xử lý sự cố thiết bị.
          </p>
        </div>
      </div>

      <div className="grid-2">
        <Card render={<article />} aria-labelledby="device-info-title">
          <CardHeader>
            <div>
              <p className="eyebrow">Phần cứng</p>
              <CardTitle render={<h2 />} id="device-info-title">
                Thông tin thiết bị
              </CardTitle>
            </div>
            <CardAction>
              <Badge tone={tone} label={label} icon={badgeIcon} />
            </CardAction>
          </CardHeader>

          <dl className="detail-list">
            <div>
              <dt>Serial</dt>
              <dd className="mono">{device?.serial || '—'}</dd>
            </div>
            <div>
              <dt>Model</dt>
              <dd>{device?.model || '—'}</dd>
            </div>
            <div>
              <dt>Android</dt>
              <dd>{device?.android || '—'}</dd>
            </div>
            <div>
              <dt>Kiến trúc</dt>
              <dd>{device?.abi || '—'}</dd>
            </div>
            <div>
              <dt>Trạng thái ADB</dt>
              <dd>{adbLabel}</dd>
            </div>
            <div>
              <dt>Daemon proxy</dt>
              <dd>{device?.daemon_running ? 'Đang chạy' : 'Đã dừng'}</dd>
            </div>
            <div>
              <dt>Forward cổng</dt>
              <dd>{proxy?.forwarded ? `Đã forward cổng ${proxy.port || '—'}` : 'Chưa forward'}</dd>
            </div>
            <div>
              <dt>Kết nối từ</dt>
              <dd>
                {device?.since
                  ? `${formatDuration(Math.max(0, now - device.since))} · từ ${formatClock(
                      device.since,
                    )}`
                  : '—'}
              </dd>
            </div>
          </dl>

          <div className="inline-alert inline-alert-danger" role="alert" hidden={!hasError}>
            <strong>Thiết bị cần chú ý</strong>
            <p>{device?.error}</p>
          </div>

          <CardFooter>
            <Button
              variant="outline"
              loading={reconnecting}
              disabled={reconnectDisabled}
              title={reconnectTitle}
              onClick={() => void reconnectDevice()}
            >
              Kết nối lại
            </Button>
            <Button
              variant="outline"
              loading={restarting}
              disabled={restartDisabled}
              title={restartTitle}
              onClick={() => void restartProxy()}
            >
              Khởi động lại daemon
            </Button>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="battery-info-title">
          <CardHeader>
            <div>
              <p className="eyebrow">An toàn phần cứng</p>
              <CardTitle render={<h2 />} id="battery-info-title">
                Pin & Nhiệt độ
              </CardTitle>
            </div>
            <CardAction>
              <Badge
                tone={battery ? batteryTone : 'neutral'}
                label={
                  battery
                    ? battery.warning_level === 'danger'
                      ? `${battery.temperature != null ? `${battery.temperature}°C ` : ''}Quá nhiệt`
                      : battery.warning_level === 'warning'
                        ? `${battery.temperature != null ? `${battery.temperature}°C ` : ''}Ấm`
                        : `${battery.temperature != null ? `${battery.temperature}°C ` : ''}An toàn`
                    : 'Chưa có thông tin'
                }
                icon={
                  battery?.warning_level === 'danger'
                    ? 'flame'
                    : battery?.warning_level === 'warning'
                      ? 'alert'
                      : 'battery'
                }
              />
            </CardAction>
          </CardHeader>

          <dl className="detail-list">
            <div>
              <dt>Mức pin</dt>
              <dd>
                {battery?.level != null ? (
                  <span className="flex items-center gap-1.5 font-semibold">
                    {battery.level}%
                    {battery.status === 'charging' && <Icon name="zap" className="size-3.5" />}
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Nhiệt độ pin</dt>
              <dd>
                {battery?.temperature != null ? (
                  <span
                    className={
                      battery.warning_level === 'danger'
                        ? 'font-bold text-destructive'
                        : battery.warning_level === 'warning'
                          ? 'font-semibold text-warning'
                          : 'font-semibold'
                    }
                  >
                    {battery.temperature}°C
                    {battery.temperature > 40 && ' (Cần chú ý tản nhiệt)'}
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt>Trạng thái sạc</dt>
              <dd>
                {battery?.charging_disabled
                  ? 'Đã ngắt sạc (Bảo vệ pin)'
                  : battery?.status
                    ? batteryStatusLabels[battery.status] || battery.status
                    : '—'}
              </dd>
            </div>
            <div>
              <dt>Nguồn cấp</dt>
              <dd>{battery?.plugged ? batteryPluggedLabels[battery.plugged] || battery.plugged : '—'}</dd>
            </div>
            <div>
              <dt>Sức khỏe pin</dt>
              <dd>{battery?.health ? batteryHealthLabels[battery.health] || battery.health : '—'}</dd>
            </div>
            <div>
              <dt>Điện áp</dt>
              <dd>{battery?.voltage_mv ? `${(battery.voltage_mv / 1000).toFixed(2)} V` : '—'}</dd>
            </div>
          </dl>

          {battery?.warning_level === 'danger' && (
            <div className="inline-alert inline-alert-danger" role="alert">
              <strong>Nhiệt độ quá 45°C!</strong>
              <p>
                Pin điện thoại đang rất nóng. Nguy cơ phồng/chai pin nếu cắm phát 4G liên tục ở nhiệt độ này.
                {battery.charging_disabled
                  ? ' Đã tự động kích hoạt ngắt sạc.'
                  : ' Hãy tạm ngắt sạc hoặc đặt máy trước quạt.'}
              </p>
            </div>
          )}

          {battery?.warning_level === 'warning' && (
            <div className="inline-alert" role="alert">
              <strong>Điện thoại đang ấm (&gt;40°C)</strong>
              <p>Khuyến khích tháo ốp lưng, để máy nơi thoáng khí hoặc dùng quạt tản nhiệt mini.</p>
            </div>
          )}

          <CardFooter>
            <Button
              variant="outline"
              loading={togglingCharging}
              disabled={!device?.connected || togglingCharging}
              onClick={() => void setDeviceCharging(Boolean(battery?.charging_disabled))}
            >
              {battery?.charging_disabled ? 'Bật lại sạc pin' : 'Tạm ngắt sạc pin'}
            </Button>
          </CardFooter>
        </Card>

        <Card render={<article />} aria-labelledby="setup-title">
          <CardHeader>
            <div>
              <p className="eyebrow">Thiết lập</p>
              <CardTitle render={<h2 />} id="setup-title">
                Chuẩn bị một lần
              </CardTitle>
            </div>
          </CardHeader>

          <ol className="checklist">
            <li>
              <span className="check-index" aria-hidden="true">
                1
              </span>
              <div>
                <strong>Bật Gỡ lỗi USB</strong>
                <p>
                  Cài đặt → Thông tin điện thoại → chạm 7 lần vào Số bản dựng, sau đó bật Gỡ
                  lỗi USB trong Tùy chọn nhà phát triển.
                </p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                2
              </span>
              <div>
                <strong>Ủy quyền cho máy tính</strong>
                <p>Khi điện thoại hỏi, chọn “Luôn cho phép từ máy tính này”.</p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                3
              </span>
              <div>
                <strong>Cắm cáp USB ổn định</strong>
                <p>Dùng cáp truyền dữ liệu. Giữ điện thoại mở khóa trong lần kết nối đầu.</p>
              </div>
            </li>
            <li>
              <span className="check-index" aria-hidden="true">
                4
              </span>
              <div>
                <strong>Kiểm tra mạng 4G</strong>
                <p>Tắt Wi-Fi trên điện thoại để proxy sử dụng dữ liệu di động.</p>
              </div>
            </li>
          </ol>

          <div className="callout">
            <Icon name="alert" />
            <p>
              Đổi IP bằng chế độ máy bay sẽ ngắt kết nối 4G khoảng 5–10 giây. Các phiên đang
              tải có thể bị gián đoạn.
            </p>
          </div>
        </Card>
      </div>

      <Card render={<article />} aria-labelledby="troubleshoot-title">
        <CardHeader>
          <div>
            <p className="eyebrow">ADB</p>
            <CardTitle render={<h2 />} id="troubleshoot-title">
              Xử lý sự cố nhanh
            </CardTitle>
          </div>
        </CardHeader>
        <div className="grid-3 text-grid">
          <div>
            <h3>Không thấy thiết bị</h3>
            <p>
              Chạy <code>adb devices</code>. Nếu trạng thái là <code>unauthorized</code>, mở
              khóa điện thoại và chấp nhận hộp thoại ủy quyền.
            </p>
          </div>
          <div>
            <h3>Daemon không chạy</h3>
            <p>
              Bấm “Khởi động lại daemon”. Nếu vẫn lỗi, bấm “Kết nối lại” để đẩy lại binary
              qua ADB.
            </p>
          </div>
          <div>
            <h3>Không có Internet</h3>
            <p>
              Kiểm tra Wi-Fi đã tắt, sóng 4G còn dung lượng và chế độ máy bay đã được tắt sau
              khi xoay.
            </p>
          </div>
        </div>
      </Card>
    </section>
  );
}
