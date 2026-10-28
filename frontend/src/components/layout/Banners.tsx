import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { useDashboard } from '../../app/providers/DashboardProvider';

function deviceBannerCopy(status: string, error: string | null, adbAvailable: boolean) {
  switch (status) {
    case 'preparing':
      return {
        title: 'Đang thiết lập thiết bị',
        text: 'Đang đồng bộ daemon proxy và kiểm tra kết nối 4G. Quá trình mất vài giây.',
      };
    case 'unauthorized':
      return {
        title: 'Thiết bị chưa được ủy quyền',
        text: 'Mở khóa điện thoại và chọn “Luôn cho phép từ máy tính này” trong hộp thoại gỡ lỗi USB.',
      };
    case 'adb-missing':
      return {
        title: 'Không tìm thấy ADB',
        text: 'Cài Android Platform Tools và thêm adb vào PATH, sau đó khởi động lại ứng dụng.',
      };
    case 'error':
      return {
        title: 'Không thiết lập được proxy',
        text: error
          ? error
          : adbAvailable === false
            ? 'Kiểm tra ADB và kết nối USB.'
            : 'Mở trang Thiết bị để xem chi tiết.',
      };
    default:
      return {
        title: 'Chưa có thiết bị Android',
        text: 'Cắm cáp USB, bật Gỡ lỗi USB và ủy quyền cho máy tính.',
      };
  }
}

export function Banners() {
  const { status, connection, statusError, refreshAll } = useDashboard();

  if (connection === 'offline') {
    return (
      <div className="banner banner-danger" id="service-banner" role="alert">
        <div className="banner-icon" aria-hidden="true">
          <Icon name="alert" />
        </div>
        <div className="banner-body">
          <strong>Không kết nối được dịch vụ điều khiển.</strong>
          <p>{statusError || 'Dashboard sẽ tự thử lại. Kiểm tra cửa sổ terminal đang chạy proxy.'}</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          id="banner-retry"
          type="button"
          onClick={() => void refreshAll({ spinner: true })}
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (connection !== 'online' || !status || status.device.status === 'ready') return null;

  const copy = deviceBannerCopy(
    status.device.status,
    status.device.error,
    status.app.adb_available,
  );

  return (
    <div className="banner banner-warning" id="device-banner" role="status">
      <div className="banner-icon" aria-hidden="true">
        <Icon name="phone" />
      </div>
      <div className="banner-body">
        <strong>{copy.title}</strong>
        <p>{copy.text}</p>
      </div>
      <Link className="btn btn-secondary btn-sm" id="device-banner-link" to="/device">
        Xem thiết bị
      </Link>
    </div>
  );
}
