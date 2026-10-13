import { styles as adminStyles } from "../admin/admin-styles";

const ADMIN_SHELL = adminStyles.adminShell;

export const styles = {
  ...adminStyles,
  adminShell: `${ADMIN_SHELL} adminShellSuper`,
};
