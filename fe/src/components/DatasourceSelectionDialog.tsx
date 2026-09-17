import { Database } from 'lucide-solid';
import type { PageResult } from '../types/common';
import type { DatasourceOption } from '../types/datasource';
import PagedSelectionDialog, { type SelectionPageRequest } from './PagedSelectionDialog';

interface DatasourceSelectionDialogProps {
  open: boolean;
  selectedId: number | null;
  description?: string;
  loadPage: (request: DatasourcePageRequest) => Promise<PageResult<DatasourceOption>>;
  onOpenChange: (open: boolean) => void;
  onSelect: (datasource: DatasourceOption) => void;
}

export type DatasourcePageRequest = SelectionPageRequest;

export default function DatasourceSelectionDialog(props: DatasourceSelectionDialogProps) {
  return <PagedSelectionDialog
    open={props.open}
    selectedId={props.selectedId === null ? null : String(props.selectedId)}
    title="选择数据源"
    description={props.description || '搜索名称或展示名称，然后选择一个数据源'}
    searchPlaceholder="搜索数据源"
    emptyText="没有匹配的数据源"
    loadingText="正在加载数据源"
    countLabel="个数据源"
    icon={(size) => <Database size={size} />}
    loadPage={async (request) => {
      const result = await props.loadPage(request);
      return {
        total: result.total,
        items: result.items.map((item) => ({ id: String(item.id), label: item.display_name, detail: item.name })),
      };
    }}
    onOpenChange={props.onOpenChange}
    onSelect={(item) => props.onSelect({ id: Number(item.id), display_name: item.label, name: item.detail })}
  />;
}
