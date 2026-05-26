import { useMemo, useState } from 'react';
import { NextSeo } from 'next-seo';
import {
  Badge,
  Button,
  Group,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core';

import api from '@/api';
import { useBrandDisplayName } from '@/theme/ThemeProvider';

const OUTCOMES = ['', 'success', 'failure', 'denied'] as const;

// FIB §3-5 audit-search dashboard. Security-admin only. Renders the
// HdxAuditEvent stream with the FIB-required selectivity facets:
//   - subject (actorEmail, actorIp)
//   - object  (objectKind, objectId)
//   - type    (category, action)
//   - time    (from, to)
// The read itself is journaled by the backend (FIB §30).
export default function AuditPage() {
  const brand = useBrandDisplayName();
  const { data: me } = api.useMe();

  const [filters, setFilters] = useState<Record<string, string | undefined>>({
    limit: '100',
  });

  const { data, isLoading, refetch } = api.useAuditEvents(filters);
  const events = data?.events ?? [];

  const role = (me as any)?.role ?? 'user';
  const allowed = role === 'securityAdmin';

  const update = (k: string, v: string | undefined) =>
    setFilters(prev => ({ ...prev, [k]: v }));

  const rows = useMemo(
    () =>
      events.map(ev => (
        <Table.Tr key={ev._id}>
          <Table.Td>
            <Text size="xs" ff="monospace">
              {new Date(ev.ts).toISOString()}
            </Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{ev.actorEmail ?? '—'}</Text>
            <Text size="xs" c="dimmed">
              {ev.actorIp ?? ''}
            </Text>
          </Table.Td>
          <Table.Td>
            <Text size="sm">{ev.category}</Text>
            <Text size="xs" c="dimmed">
              {ev.action}
            </Text>
          </Table.Td>
          <Table.Td>
            <Badge
              color={
                ev.outcome === 'success'
                  ? 'green'
                  : ev.outcome === 'denied'
                    ? 'orange'
                    : 'red'
              }
              variant="light"
            >
              {ev.outcome}
            </Badge>
          </Table.Td>
          <Table.Td>
            {ev.objectKind ? (
              <>
                <Text size="sm">{ev.objectKind}</Text>
                <Text size="xs" c="dimmed">
                  {ev.objectId ?? ''}
                </Text>
              </>
            ) : (
              <Text size="xs" c="dimmed">
                —
              </Text>
            )}
          </Table.Td>
          <Table.Td>
            <Text size="xs" ff="monospace">
              {ev.errorMessage ?? JSON.stringify(ev.details ?? {})}
            </Text>
          </Table.Td>
        </Table.Tr>
      )),
    [events],
  );

  if (!me) {
    return null;
  }

  if (!allowed) {
    return (
      <div className="p-4">
        <NextSeo title={`Audit — ${brand}`} />
        <Title order={2}>Audit</Title>
        <Text mt="md">
          Этот раздел доступен только администратору безопасности (роль{' '}
          <code>securityAdmin</code>). Ваша роль: <code>{role}</code>.
        </Text>
      </div>
    );
  }

  return (
    <div className="p-4">
      <NextSeo title={`Audit — ${brand}`} />
      <Title order={2}>Журнал аудита</Title>
      <Text c="dimmed" size="sm" mt="xs">
        FIB §1-6 — все действия пользователей и администраторов системы.
        Просмотр журнала также журналируется (FIB §30).
      </Text>

      <Paper p="md" mt="md" withBorder>
        <Stack gap="sm">
          <Group grow>
            <TextInput
              label="Email пользователя"
              placeholder="user@example.kz"
              value={filters.actorEmail ?? ''}
              onChange={e =>
                update('actorEmail', e.currentTarget.value || undefined)
              }
            />
            <TextInput
              label="IP"
              placeholder="203.0.113.x"
              value={filters.actorIp ?? ''}
              onChange={e =>
                update('actorIp', e.currentTarget.value || undefined)
              }
            />
            <TextInput
              label="Категория"
              placeholder="auth, user, dashboard…"
              value={filters.category ?? ''}
              onChange={e =>
                update('category', e.currentTarget.value || undefined)
              }
            />
            <TextInput
              label="Действие"
              placeholder="login.success, password.changed…"
              value={filters.action ?? ''}
              onChange={e =>
                update('action', e.currentTarget.value || undefined)
              }
            />
            <Select
              label="Исход"
              data={[
                { value: '', label: 'Любой' },
                { value: 'success', label: 'success' },
                { value: 'failure', label: 'failure' },
                { value: 'denied', label: 'denied' },
              ]}
              value={filters.outcome ?? ''}
              onChange={v => update('outcome', v || undefined)}
            />
          </Group>
          <Group grow>
            <TextInput
              label="С (UTC)"
              placeholder="2026-05-26T00:00:00Z"
              value={filters.from ?? ''}
              onChange={e =>
                update('from', e.currentTarget.value || undefined)
              }
            />
            <TextInput
              label="По (UTC)"
              placeholder="2026-05-26T23:59:59Z"
              value={filters.to ?? ''}
              onChange={e => update('to', e.currentTarget.value || undefined)}
            />
            <TextInput
              label="Объект (kind)"
              value={filters.objectKind ?? ''}
              onChange={e =>
                update('objectKind', e.currentTarget.value || undefined)
              }
            />
            <TextInput
              label="Объект (id)"
              value={filters.objectId ?? ''}
              onChange={e =>
                update('objectId', e.currentTarget.value || undefined)
              }
            />
          </Group>
          <Group>
            <Button variant="primary" onClick={() => refetch()}>
              Поиск
            </Button>
            <Button
              variant="secondary"
              onClick={() => setFilters({ limit: '100' })}
            >
              Сбросить
            </Button>
          </Group>
        </Stack>
      </Paper>

      <Paper p="md" mt="md" withBorder>
        {isLoading ? (
          <Text>Загрузка…</Text>
        ) : events.length === 0 ? (
          <Text c="dimmed">Нет событий за выбранный период.</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Время</Table.Th>
                <Table.Th>Субъект</Table.Th>
                <Table.Th>Тип</Table.Th>
                <Table.Th>Исход</Table.Th>
                <Table.Th>Объект</Table.Th>
                <Table.Th>Детали</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>{rows}</Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
