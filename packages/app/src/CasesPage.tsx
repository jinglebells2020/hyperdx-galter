import { useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Select,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Timeline,
  Title,
  Tooltip,
} from '@mantine/core';
import { IconArrowLeft, IconRefresh } from '@tabler/icons-react';

import {
  AuditCase,
  CaseSeverity,
  CaseStatus,
  severityColor,
  severityLabel,
  statusColor,
  statusLabel,
  useAddNote,
  useCase,
  useCases,
  useCloseCase,
  useReopenCase,
  useUpdateCase,
} from '@/hooks/cases';

function formatRu(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      timeZone: 'Asia/Almaty',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function CasesListPage() {
  const [statusFilter, setStatusFilter] = useState<CaseStatus | ''>('');
  const [severityFilter, setSeverityFilter] = useState<CaseSeverity | ''>('');
  const { data, isLoading, refetch } = useCases({
    status: (statusFilter || undefined) as CaseStatus | undefined,
    severity: (severityFilter || undefined) as CaseSeverity | undefined,
  });

  return (
    <>
      <Head>
        <title>Дела · Mooldir</title>
      </Head>
      <Container size="xl" py="lg">
        <Group justify="space-between" mb="md">
          <Title order={2}>Журнал дел</Title>
          <Group>
            <ActionIcon variant="default" onClick={() => refetch()} title="Обновить">
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Group>

        <Group mb="md">
          <Select
            label="Статус"
            placeholder="Все статусы"
            data={[
              { value: 'open', label: 'Открыто' },
              { value: 'in_progress', label: 'В работе' },
              { value: 'pending_clarification', label: 'Ожидает уточнения' },
              { value: 'resolved', label: 'Разрешено' },
              { value: 'closed', label: 'Закрыто' },
              { value: 'reopened', label: 'Возобновлено' },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter((v || '') as CaseStatus | '')}
            clearable
            w={220}
          />
          <Select
            label="Уровень риска"
            placeholder="Все уровни"
            data={[
              { value: 'critical', label: 'Критический' },
              { value: 'high', label: 'Высокий' },
              { value: 'medium', label: 'Средний' },
              { value: 'low', label: 'Низкий' },
            ]}
            value={severityFilter}
            onChange={(v) => setSeverityFilter((v || '') as CaseSeverity | '')}
            clearable
            w={220}
          />
        </Group>

        {isLoading ? (
          <Loader />
        ) : !data || data.length === 0 ? (
          <Card>
            <Text c="dimmed">Дел не зарегистрировано. Дела создаются автоматически правилами обнаружения или вручную следователями.</Text>
          </Card>
        ) : (
          <Card padding={0} withBorder>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>№ дела</Table.Th>
                  <Table.Th>Заголовок</Table.Th>
                  <Table.Th>Уровень</Table.Th>
                  <Table.Th>Статус</Table.Th>
                  <Table.Th>Исполнитель</Table.Th>
                  <Table.Th>Тип обнаружения</Table.Th>
                  <Table.Th>Открыто</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((c) => (
                  <Table.Tr key={c._id} style={{ cursor: 'pointer' }}>
                    <Table.Td>
                      <Link href={`/cases/${c._id}`} style={{ textDecoration: 'none' }}>
                        <Text fw={500}>{c.case_number}</Text>
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      <Link href={`/cases/${c._id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <Text size="sm" lineClamp={2}>
                          {c.title}
                        </Text>
                      </Link>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={severityColor(c.severity)} variant="filled">
                        {severityLabel(c.severity)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(c.status)} variant="light">
                        {statusLabel(c.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c={c.assignee_email ? undefined : 'dimmed'}>
                        {c.assignee_email || 'не назначен'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Tooltip
                        label={
                          c.tier_detected_by === 'manual'
                            ? 'Создано вручную'
                            : c.tier_detected_by === 'tier1'
                              ? 'Tier 1 — детерминистические правила'
                              : c.tier_detected_by === 'tier2'
                                ? 'Tier 2 — LLM-судья'
                                : 'Tier 3 — паттерн-анализ'
                        }
                      >
                        <Badge variant="default" size="sm">
                          {c.tier_detected_by}
                        </Badge>
                      </Tooltip>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {formatRu(c.createdAt)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}
      </Container>
    </>
  );
}

export function CaseDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : undefined;
  const { data, isLoading } = useCase(id);
  const update = useUpdateCase();
  const addNoteM = useAddNote();
  const closeM = useCloseCase();
  const reopenM = useReopenCase();

  const [noteText, setNoteText] = useState('');

  const isClosed = data?.status === 'closed';

  return (
    <>
      <Head>
        <title>{data?.case_number || 'Дело'} · Mooldir</title>
      </Head>
      <Container size="xl" py="lg">
        <Group mb="md">
          <ActionIcon variant="default" onClick={() => router.push('/cases')}>
            <IconArrowLeft size={16} />
          </ActionIcon>
          <Text c="dimmed">Журнал дел</Text>
        </Group>

        {isLoading || !data ? (
          <Loader />
        ) : (
          <Stack gap="md">
            <Card withBorder>
              <Group justify="space-between" mb="xs">
                <Group>
                  <Title order={3}>{data.case_number}</Title>
                  <Badge color={severityColor(data.severity)} variant="filled">
                    {severityLabel(data.severity)}
                  </Badge>
                  <Badge color={statusColor(data.status)} variant="light">
                    {statusLabel(data.status)}
                  </Badge>
                </Group>
                <Group>
                  <Select
                    placeholder="Изменить уровень"
                    data={[
                      { value: 'critical', label: 'Критический' },
                      { value: 'high', label: 'Высокий' },
                      { value: 'medium', label: 'Средний' },
                      { value: 'low', label: 'Низкий' },
                    ]}
                    value={data.severity}
                    onChange={(v) =>
                      v && update.mutate({ id: data._id, patch: { severity: v as CaseSeverity } })
                    }
                    w={180}
                    size="sm"
                    disabled={isClosed}
                  />
                  <Select
                    placeholder="Изменить статус"
                    data={[
                      { value: 'open', label: 'Открыто' },
                      { value: 'in_progress', label: 'В работе' },
                      { value: 'pending_clarification', label: 'Ожидает уточнения' },
                      { value: 'resolved', label: 'Разрешено' },
                    ]}
                    value={data.status === 'closed' ? '' : data.status}
                    onChange={(v) =>
                      v && update.mutate({ id: data._id, patch: { status: v as CaseStatus } })
                    }
                    w={220}
                    size="sm"
                    disabled={isClosed}
                  />
                </Group>
              </Group>
              <Title order={4} mb="xs">
                {data.title}
              </Title>
              {data.description && (
                <Text size="sm" mt="xs">
                  {data.description}
                </Text>
              )}
              <Group mt="md" gap="xl">
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Тип обнаружения
                  </Text>
                  <Text size="sm">{data.tier_detected_by}</Text>
                </Box>
                {data.rule_name && (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      Правило
                    </Text>
                    <Text size="sm">{data.rule_name}</Text>
                  </Box>
                )}
                <Box>
                  <Text size="xs" c="dimmed" tt="uppercase">
                    Открыто
                  </Text>
                  <Text size="sm">{formatRu(data.createdAt)}</Text>
                </Box>
                {data.assignee_email && (
                  <Box>
                    <Text size="xs" c="dimmed" tt="uppercase">
                      Исполнитель
                    </Text>
                    <Text size="sm">{data.assignee_email}</Text>
                  </Box>
                )}
              </Group>
              <Group mt="md">
                {!isClosed && (
                  <Button
                    color="green"
                    variant="filled"
                    onClick={() =>
                      closeM.mutate({ id: data._id, close_reason: 'confirmed' })
                    }
                  >
                    Закрыть · подтверждено
                  </Button>
                )}
                {!isClosed && (
                  <Button
                    color="gray"
                    variant="default"
                    onClick={() =>
                      closeM.mutate({
                        id: data._id,
                        close_reason: 'rejected_false_positive',
                      })
                    }
                  >
                    Закрыть · ложное срабатывание
                  </Button>
                )}
                {isClosed && (
                  <Button color="orange" onClick={() => reopenM.mutate(data._id)}>
                    Возобновить дело
                  </Button>
                )}
              </Group>
            </Card>

            {data.related_entity_ids.length > 0 && (
              <Card withBorder>
                <Title order={5} mb="xs">
                  Связанные объекты ({data.related_entity_ids.length})
                </Title>
                <Stack gap={4}>
                  {data.related_entity_ids.map((eid) => (
                    <Link
                      key={eid}
                      href={`/search?q=${encodeURIComponent(`entity_id:"${eid}"`)}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <Text size="sm" ff="monospace" c="blue">
                        {eid}
                      </Text>
                    </Link>
                  ))}
                </Stack>
              </Card>
            )}

            {data.citations.length > 0 && (
              <Card withBorder>
                <Title order={5} mb="xs">
                  Нормативные источники
                </Title>
                <Stack gap="xs">
                  {data.citations.map((c, i) => (
                    <Box key={i}>
                      <Text size="sm" fw={500}>
                        {c.npa}
                      </Text>
                      {c.excerpt && (
                        <Text size="xs" c="dimmed" mt={2}>
                          {c.excerpt}
                        </Text>
                      )}
                      {c.url && (
                        <Text size="xs" c="blue" component="a" href={c.url}>
                          Открыть источник
                        </Text>
                      )}
                    </Box>
                  ))}
                </Stack>
              </Card>
            )}

            <Card withBorder>
              <Title order={5} mb="xs">
                Заметки следователя ({data.notes.length})
              </Title>
              <Stack gap="xs" mb="md">
                {data.notes.map((n, i) => (
                  <Box key={i}>
                    <Text size="xs" c="dimmed">
                      {formatRu(n.at)} · {n.author}
                    </Text>
                    <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                      {n.text}
                    </Text>
                  </Box>
                ))}
                {data.notes.length === 0 && (
                  <Text size="sm" c="dimmed">
                    Заметок пока нет
                  </Text>
                )}
              </Stack>
              {!isClosed && (
                <Stack gap="xs">
                  <Textarea
                    placeholder="Добавить заметку…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.currentTarget.value)}
                    minRows={2}
                  />
                  <Group justify="flex-end">
                    <Button
                      size="sm"
                      disabled={!noteText.trim() || addNoteM.isPending}
                      onClick={() => {
                        if (!noteText.trim()) return;
                        addNoteM.mutate(
                          { id: data._id, text: noteText.trim() },
                          {
                            onSuccess: () => setNoteText(''),
                          },
                        );
                      }}
                    >
                      Сохранить заметку
                    </Button>
                  </Group>
                </Stack>
              )}
            </Card>

            <Card withBorder>
              <Title order={5} mb="md">
                Хронология ({data.timeline.length})
              </Title>
              <Timeline active={data.timeline.length - 1} bulletSize={18} lineWidth={2}>
                {data.timeline.map((t, i) => (
                  <Timeline.Item
                    key={i}
                    title={
                      <Group gap={6}>
                        <Text size="sm" fw={500}>
                          {timelineLabel(t.kind)}
                        </Text>
                        <Text size="xs" c="dimmed">
                          · {t.actor}
                        </Text>
                      </Group>
                    }
                  >
                    <Text size="xs" c="dimmed">
                      {formatRu(t.at)}
                    </Text>
                    {t.diff && (
                      <Text size="xs" mt={2} ff="monospace">
                        {JSON.stringify(t.diff)}
                      </Text>
                    )}
                    {t.note && (
                      <Text size="sm" mt={2}>
                        {t.note}
                      </Text>
                    )}
                  </Timeline.Item>
                ))}
              </Timeline>
            </Card>
          </Stack>
        )}
      </Container>
    </>
  );
}

function timelineLabel(kind: string): string {
  return (
    {
      created: 'Дело открыто',
      assigned: 'Назначен исполнитель',
      unassigned: 'Снято назначение',
      status_changed: 'Изменён статус',
      severity_changed: 'Изменён уровень риска',
      note_added: 'Добавлена заметка',
      evidence_added: 'Добавлено доказательство',
      citation_added: 'Добавлен нормативный источник',
      reopened: 'Дело возобновлено',
      closed: 'Дело закрыто',
      escalated: 'Эскалация',
    }[kind] || kind
  );
}
