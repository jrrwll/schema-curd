import { Check, Plus } from 'lucide-solid';
import { Show } from 'solid-js';
import type { EntityTableView } from '../types/entity';
import EntityDataTable from './entity/EntityDataTable';
import EntityDetailDialog from './entity/EntityDetailDialog';
import EntityJsonEditDialog from './entity/EntityJsonEditDialog';
import EntityListFilters from './entity/EntityListFilters';
import EntityUpdateConfirmationDialog from './entity/EntityUpdateConfirmationDialog';
import { createEntityListController } from './entity/createEntityListController';

interface ListPageProps {
  canWrite: boolean;
  datasource: string;
  table: EntityTableView;
  navigate: (url: string) => void;
}

export default function ListPage(props: ListPageProps) {
  const table = () => props.table;
  const canWrite = () => props.canWrite;
  const state = createEntityListController({
    get canWrite() { return canWrite(); },
    get table() { return table(); },
  });

  return (
    <main class="page-shell entity-list-embedded">
      <header class="page-header">
        <div>
          <div class="eyebrow">数据表</div>
          <h1>{table().display_name}</h1>
          <div class="table-code">{table().name}</div>
        </div>
        <Show when={props.canWrite}>
          <button
            class="button button-primary"
            onClick={() => props.navigate(`/entity/create?datasource=${encodeURIComponent(props.datasource)}&table=${props.table.id}`)}
          >
            <Plus size={17} />新增
          </button>
        </Show>
      </header>

      <EntityListFilters table={table()} controller={state} />

      <Show when={state.message()}>
        {(notice) => <div class={`notice notice-${notice().kind}`}>{notice().kind === 'success' && <Check size={15} />}{notice().text}</div>}
      </Show>

      <EntityDataTable canWrite={canWrite()} table={table()} controller={state} />

      <EntityUpdateConfirmationDialog
        open={state.confirmingRow() !== null}
        identity={state.rowIdentity(state.confirmingRow())}
        diffs={state.rowDiff(state.confirmingRow())}
        updating={state.updating() !== null}
        onOpenChange={state.changeUpdateConfirmation}
        onConfirm={state.confirmRowUpdate}
      />
      <EntityJsonEditDialog
        open={state.jsonCellEdit() !== null}
        column={state.jsonCellEdit()?.column ?? null}
        value={state.jsonDraft()}
        original={state.jsonOriginal()}
        valid={state.jsonValid()}
        onChange={state.setJsonDraft}
        onConfirm={state.confirmJsonCellEdit}
        onDiscard={state.discardJsonCellEdit}
      />
      <EntityDetailDialog
        open={state.detailRow() !== null}
        table={table()}
        row={state.detailRow() === null ? null : state.rows()[state.detailRow()!] ?? null}
        identity={state.rowIdentity(state.detailRow())}
        onRequestClose={state.closeDetail}
      />
    </main>
  );
}
