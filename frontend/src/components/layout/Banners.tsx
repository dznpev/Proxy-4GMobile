import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '../ui/alert';
import { Button, buttonVariants } from '../ui/button';
import { useDashboard } from '../../app/providers/DashboardProvider';

type BannerVariant = 'error' | 'info' | 'warning';

function deviceBannerCopy(
  status: string,
  error: string | null,
  adbAvailable: boolean,
): { title: string; text: string; variant: BannerVariant; icon: string } {
  switch (status) {
    case 'preparing':
      return {
        title: 'Đang thiết lập thiết bị',
        text: 'Đang đồng bộ daemon proxy và kiểm tra kết nối 4G. Quá trình mất vài giây.',
        variant: 'info',
        icon: 'refresh',
      };
    case 'unauthorized':
      return {
        title: 'Thiết bị chưa được ủy quyền',
        text: 'Mở khóa điện thoại và chọn “Luôn cho phép từ máy tính này” trong hộp thoại gỡ lỗi USB.',
        variant: 'warning',
        icon: 'phone',
      };
    case 'adb-missing':
      return {
        title: 'Không tìm thấy ADB',
        text: 'Cài Android Platform Tools và thêm adb vào PATH, sau đó khởi động lại ứng dụng.',
        variant: 'warning',
        icon: 'alert',
      };
    case 'error':
      return {
        title: 'Không thiết lập được proxy',
        text: error
          ? error
          : adbAvailable === false
            ? 'Kiểm tra ADB và kết nối USB.'
            : 'Mở trang Thiết bị để xem chi tiết.',
        variant: 'error',
        icon: 'alert',
      };
    default:
      return {
        title: 'Chưa có thiết bị Android',
        text: 'Cắm cáp USB, bật Gỡ lỗi USB và ủy quyền cho máy tính.',
        variant: 'warning',
        icon: 'phone',
      };
  }
}

export function Banners() {
  const { status, connection, statusError, refreshAll } = useDashboard();

  if (connection === 'offline') {
    return (
      <Alert className="mb-3" id="service-banner" variant="error">
        <Icon name="alert" />
        <AlertTitle>Không kết nối được dịch vụ điều khiển.</AlertTitle>
        <AlertDescription>
          {statusError ||
            'Dashboard sẽ tự thử lại. Kiểm tra cửa sổ terminal đang chạy proxy.'}
        </AlertDescription>
        <AlertAction>
          <Button
            id="banner-retry"
            size="sm"
            variant="outline"
            className="pointer-coarse:min-h-11"
            onClick={() => void refreshAll({ spinner: true })}
          >
            Thử lại
          </Button>
        </AlertAction>
      </Alert>
    );
  }

  if (connection !== 'online' || !status) {
    return null;
  }

  if (status.device.battery?.warning_level === 'danger') {
    return (
      <Alert className="mb-3" id="thermal-banner" variant="error">
        <Icon name="flame" />
        <AlertTitle>Cảnh báo quá nhiệt pin: {status.device.battery.temperature}°C</AlertTitle>
        <AlertDescription>
          Nhiệt độ điện thoại vượt ngưỡng an toàn (45°C). Nguy cơ phồng và chai pin.
          {status.device.battery.charging_disabled
            ? ' Đã tự động ngắt sạc bảo vệ thiết bị.'
            : ' Hãy rút sạc hoặc chuyển sang vị trí thoáng mát.'}
        </AlertDescription>
        <AlertAction>
          <Link
            className={buttonVariants({
              size: 'sm',
              variant: 'outline',
              className: 'pointer-coarse:min-h-11',
            })}
            id="thermal-banner-link"
            to="/device"
          >
            Quản lý pin
          </Link>
        </AlertAction>
      </Alert>
    );
  }

  if (status.device.status === 'ready') {
    return null;
  }

  const copy = deviceBannerCopy(
    status.device.status,
    status.device.error,
    status.app.adb_available,
  );

  return (
    <Alert className="mb-3" id="device-banner" variant={copy.variant}>
      <Icon name={copy.icon} />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription>{copy.text}</AlertDescription>
      <AlertAction>
        <Link
          className={buttonVariants({
            size: 'sm',
            variant: 'outline',
            className: 'pointer-coarse:min-h-11',
          })}
          id="device-banner-link"
          to="/device"
        >
          Xem thiết bị
        </Link>
      </AlertAction>
    </Alert>
  );
}
