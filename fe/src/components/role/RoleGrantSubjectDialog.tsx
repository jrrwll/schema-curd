import { Table2, UserRound } from 'lucide-solid';
import type { PageResult } from '../../types/common';
import PagedSelectionDialog, { type SelectionPageRequest } from '../PagedSelectionDialog';
import type { SearchMultiOption } from '../SearchMultiSelect';

type RoleGrantSubjectType = 'user' | 'table';

interface Props {
  open: boolean;
  type: RoleGrantSubjectType;
  selectedId: number | null;
  loadPage: (request: SelectionPageRequest) => Promise<PageResult<SearchMultiOption>>;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: SearchMultiOption) => void;
}

export default function RoleGrantSubjectDialog(props: Props) {
  const user = () => props.type === 'user';
  return <PagedSelectionDialog
    open={props.open}
    selectedId={props.selectedId === null ? null : String(props.selectedId)}
    title={user() ? '选择用户' : '选择数据表'}
    description={`搜索并选择一个${user() ? '用户' : '数据表'}`}
    searchPlaceholder={`搜索${user() ? '用户' : '数据表'}`}
    emptyText="没有匹配项"
    loadingText="正在加载"
    countLabel="项"
    icon={(size) => user() ? <UserRound size={size} /> : <Table2 size={size} />}
    loadPage={props.loadPage}
    onOpenChange={props.onOpenChange}
    onSelect={props.onSelect}
  />;
}
