/** View models shared between Server Components, Server Actions and client components. */

export type ListSummary = {
  id: string;
  name: string;
  emoji: string;
  position: number;
  openCount: number;
};

export type CategoryRef = {
  id: string;
  key: string;
  name: string;
  emoji: string;
  color: string;
  position: number;
};

export type BoardItem = {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  note: string | null;
  isChecked: boolean;
  isUrgent: boolean;
  position: number;
  categoryId: string | null;
  addedBy: string | null;
  checkedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryGroup = CategoryRef & { items: BoardItem[] };

export type Board = {
  activeListId: string;
  lists: ListSummary[];
  categories: CategoryRef[];
  items: BoardItem[];
};

export type GroupedBoard = {
  urgent: BoardItem[];
  groups: CategoryGroup[];
  checked: BoardItem[];
  openCount: number;
  checkedCount: number;
};
