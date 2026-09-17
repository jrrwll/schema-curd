import { Pagination } from '@ark-ui/solid';
import { ChevronLeft, ChevronRight } from 'lucide-solid';
import { For, Show } from 'solid-js';

interface Props {
  count: number;
  page: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export default function PaginationControl(props: Props) {
  return <Pagination.Root
    class="pagination"
    count={props.count}
    page={props.page}
    pageSize={props.pageSize}
    siblingCount={1}
    boundaryCount={1}
    onPageChange={(details) => props.onPageChange(details.page)}
    translations={{
      rootLabel: '分页',
      prevTriggerLabel: '上一页',
      nextTriggerLabel: '下一页',
      itemLabel: ({ page, totalPages }) => `第 ${page} 页，共 ${totalPages} 页`,
    }}
  >
    <Pagination.PrevTrigger class="page-button page-arrow" disabled={props.loading} title="上一页"><ChevronLeft size={17} /></Pagination.PrevTrigger>
    <Pagination.Context>{(context) => <For each={context().pages}>{(item, index) => <Show when={item.type === 'page'} fallback={<Pagination.Ellipsis class="page-ellipsis" index={index()}>...</Pagination.Ellipsis>}><Pagination.Item class="page-button" type="page" value={item.type === 'page' ? item.value : 1}>{item.type === 'page' ? item.value : ''}</Pagination.Item></Show>}</For>}</Pagination.Context>
    <Pagination.NextTrigger class="page-button page-arrow" disabled={props.loading} title="下一页"><ChevronRight size={17} /></Pagination.NextTrigger>
  </Pagination.Root>;
}
