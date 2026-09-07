/** One row of `planogram_folders`, camelCased for the client. */
export interface FolderSummary {
  folderId: string;
  parentFolderId: string | null;
  folderName: string;
  /** Direct children counts, for the card subtitle. */
  subfolderCount: number;
  planogramCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Root → current folder, used for the breadcrumb trail. */
export interface FolderCrumb {
  folderId: string;
  folderName: string;
}

export type FolderActionResult =
  | { ok: true; folderId: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export type FolderDeleteResult =
  | { ok: true; deletedFolders: number; deletedPlanograms: number }
  | { ok: false; error: string };
