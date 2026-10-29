import { request } from "./api";

export const workerId = (user: any) => user?.id == null ? "" : String(user.id);
export const listLeaves = (id: string) => request<any>({ method: "GET", url: "/leave", params: { workerId: id, page: 0, size: 20, sort: "createdAt,DESC" } });
export const applyLeave = (data: any) => request({ method: "POST", url: "/leave/apply", data });
export const cancelLeave = (id: string | number) => request({ method: "PATCH", url: `/leave/${encodeURIComponent(id)}/cancel` });
export const listDocuments = (id: string) => request<any[]>({ method: "GET", url: `/workers/${encodeURIComponent(id)}/documents` });
export const listBankAccounts = (id: string) => request<any[]>({ method: "GET", url: `/workers/${encodeURIComponent(id)}/bank-accounts` });
export const listNotifications = () => request<any[]>({ method: "GET", url: "/notifications" });
export const unreadCount = () => request<{ count: number }>({ method: "GET", url: "/notifications/unread-count" });
export const markNotificationRead = (id: string | number) => request({ method: "PATCH", url: `/notifications/${encodeURIComponent(id)}/read` });
export const markAllNotificationsRead = () => request({ method: "POST", url: "/notifications/read-all" });
