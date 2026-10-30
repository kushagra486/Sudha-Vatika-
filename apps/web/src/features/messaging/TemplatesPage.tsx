import {
  fillTemplate,
  placeholderCount,
  TEMPLATE_CATEGORIES,
  TEMPLATE_FIELDS,
  templateValues,
  toTemplateName,
  type TemplateCategory,
} from '@bm/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useAuth } from '@/app/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { t } from '@/i18n';
import { useDeleteTemplate, useSaveTemplate, useTemplates, type Template } from './api';

const T = t.templates;

const SAMPLE_CONTEXT = {
  guest_name: 'Riya',
  event_date: '12 Dec',
  event_type: 'Wedding',
  space: 'Lawn',
  venue: 'Sudha Vatika',
  total: '₹2,50,000',
  advance: '₹21,000',
  link: 'https://…',
};

export function TemplatesPage() {
  const { profile } = useAuth();
  const canEdit = profile?.role === 'owner' || profile?.role === 'manager';
  const templates = useTemplates();
  const [editing, setEditing] = useState<Template | 'new' | null>(null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold sm:text-2xl">{t.nav.templates}</h1>
        {canEdit && (
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-4 w-4" /> {T.add}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{T.hint}</p>
      {templates.isPending ? (
        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
      ) : templates.isError ? (
        <p className="text-sm text-destructive">{t.common.loadError}</p>
      ) : templates.data.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{T.empty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {templates.data.map((tp) => (
            <li key={tp.id}>
              <Card
                className={canEdit ? 'h-full cursor-pointer p-4 hover:bg-muted/50' : 'h-full p-4'}
                onClick={canEdit ? () => setEditing(tp) : undefined}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-medium">{tp.name}</p>
                  <Badge>{T.categories[tp.category]}</Badge>
                  <Badge
                    tone={
                      tp.meta_status === 'approved'
                        ? 'green'
                        : tp.meta_status === 'rejected'
                          ? 'red'
                          : 'neutral'
                    }
                  >
                    {T.statuses[tp.meta_status]}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                  {fillTemplate(tp.body, templateValues(tp.variables, SAMPLE_CONTEXT))}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <TemplateDialog
          template={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function TemplateDialog({ template, onClose }: { template: Template | null; onClose: () => void }) {
  const save = useSaveTemplate();
  const del = useDeleteTemplate();
  const [label, setLabel] = useState(template?.name ?? '');
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? 'utility');
  const [body, setBody] = useState(template?.body ?? '');
  const [vars, setVars] = useState<string[]>(template?.variables ?? []);
  const [error, setError] = useState<string | null>(null);
  const count = placeholderCount(body);
  const fields = Array.from({ length: count }, (_, i) => vars[i] ?? 'guest_name');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const name = toTemplateName(label);
    if (!name || !body.trim()) return setError(t.bookings.form.required);
    save.mutate(
      {
        id: template?.id,
        name,
        language: template?.language ?? 'en',
        category,
        body: body.trim(),
        variables: fields,
        meta_status: template?.meta_status ?? 'draft',
      },
      { onSuccess: onClose, onError: () => setError(T.saveError) },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={t.common.close}>
        <DialogHeader>
          <DialogTitle>{template ? T.edit : T.add}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={T.name}
              htmlFor="tp-name"
              hint={label ? toTemplateName(label) : T.nameHint}
            >
              <Input id="tp-name" value={label} onChange={(e) => setLabel(e.target.value)} />
            </Field>
            <Field label={T.category} htmlFor="tp-cat">
              <Select
                id="tp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {T.categories[c]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label={T.body} htmlFor="tp-body" hint={T.bodyHint}>
            <Textarea
              id="tp-body"
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          {fields.map((f, i) => (
            <Field key={i} label={T.fills(i + 1)} htmlFor={`tp-v${i}`}>
              <Select
                id={`tp-v${i}`}
                value={f}
                onChange={(e) =>
                  setVars((cur) => fields.map((x, j) => (j === i ? e.target.value : (cur[j] ?? x))))
                }
              >
                {TEMPLATE_FIELDS.map((k) => (
                  <option key={k} value={k}>
                    {T.fields[k]}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
          {body && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-50">
              <p className="mb-1 text-xs font-medium uppercase opacity-70">{T.preview}</p>
              <p className="whitespace-pre-wrap">
                {fillTemplate(body, templateValues(fields, SAMPLE_CONTEXT))}
              </p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? t.common.saving : t.common.save}
            </Button>
            {template && (
              <Button
                type="button"
                variant="ghost"
                disabled={del.isPending}
                onClick={() => {
                  if (window.confirm(T.confirmDelete))
                    del.mutate(template.id, {
                      onSuccess: onClose,
                      onError: () => setError(T.inUse),
                    });
                }}
              >
                {T.delete}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
