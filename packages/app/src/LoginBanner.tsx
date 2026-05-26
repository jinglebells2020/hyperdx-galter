import { Alert } from '@mantine/core';
import { IconShieldLock } from '@tabler/icons-react';

/**
 * FIB §53 (KZ State Technical Service) — system-use notification banner.
 * Displayed before identification & authentication on the login & registration
 * screens. Text references КоАП РК and УК РК sanctions for unauthorised access.
 *
 * Customise text via the `NEXT_PUBLIC_MOOLDIR_LOGIN_BANNER_HTML` env var if
 * your installation requires a different legal notice. The default text below
 * has been reviewed for КЗ confidential-system deployments.
 */
const DEFAULT_BANNER_RU = `Внимание. Это охраняемая информационная система Mooldir. \
Доступ разрешён только уполномоченным лицам. Несанкционированный доступ, попытка \
доступа или использование системы влекут ответственность по статьям Кодекса об \
административных правонарушениях Республики Казахстан и Уголовного кодекса \
Республики Казахстан. Все действия в системе журналируются и могут быть \
использованы как доказательство.`;

export default function LoginBanner() {
  const customHtml =
    typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_MOOLDIR_LOGIN_BANNER_HTML as string | undefined);

  if (customHtml) {
    return (
      <Alert
        icon={<IconShieldLock size={18} />}
        color="yellow"
        variant="light"
        radius="md"
        styles={{ root: { marginBottom: 16 } }}
        data-test-id="login-banner"
      >
        <span dangerouslySetInnerHTML={{ __html: customHtml }} />
      </Alert>
    );
  }

  return (
    <Alert
      icon={<IconShieldLock size={18} />}
      color="yellow"
      variant="light"
      radius="md"
      styles={{ root: { marginBottom: 16 } }}
      data-test-id="login-banner"
    >
      {DEFAULT_BANNER_RU}
    </Alert>
  );
}
