import { ApiError, apiFetch } from "@/lib/api/client";

export type Bookmark = {
  id: number;
  placeId: number;
  placeName: string;
  googlePlaceId: string;
  mood: string | null;
  space: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  folderId: number | null;
  category: string | null;
  address: string | null;
};

export type BookmarkFolder = {
  id: number;
  name: string;
  color: string;
  placeCount: number;
};

export async function listBookmarks(): Promise<Bookmark[]> {
  const res = await apiFetch(`/api/bookmarks`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/bookmarks failed: ${res.status}`);
  }
  return res.json();
}

export async function addBookmark(placeId: number, folderId?: number | null): Promise<Bookmark> {
  const res = await apiFetch(`/api/bookmarks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeId, folderId: folderId ?? null }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/bookmarks failed: ${res.status}`);
  }
  return res.json();
}

export async function removeBookmark(id: number): Promise<void> {
  const res = await apiFetch(`/api/bookmarks/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/bookmarks/${id} failed: ${res.status}`);
  }
}

export async function moveBookmarkToFolder(bookmarkId: number, folderId: number | null): Promise<Bookmark> {
  const res = await apiFetch(`/api/bookmarks/${bookmarkId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `PATCH /api/bookmarks/${bookmarkId} failed: ${res.status}`);
  }
  return res.json();
}

export async function listFolders(): Promise<BookmarkFolder[]> {
  const res = await apiFetch(`/api/bookmarks/folders`);
  if (!res.ok) {
    throw new ApiError(res.status, `GET /api/bookmarks/folders failed: ${res.status}`);
  }
  return res.json();
}

// 백엔드 bookmark_folders.name은 varchar(255)지만, 폴더명은 목록/선택 모달에 짧게 보이는 라벨이라 20자로 제한한다.
export const FOLDER_NAME_MAX_LENGTH = 20;

export async function createFolder(name: string, color: string): Promise<BookmarkFolder> {
  const res = await apiFetch(`/api/bookmarks/folders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, `POST /api/bookmarks/folders failed: ${res.status}`);
  }
  return res.json();
}

export async function deleteFolder(id: number): Promise<void> {
  const res = await apiFetch(`/api/bookmarks/folders/${id}`, { method: "DELETE" });
  if (!res.ok) {
    throw new ApiError(res.status, `DELETE /api/bookmarks/folders/${id} failed: ${res.status}`);
  }
}
