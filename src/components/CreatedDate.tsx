const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kathmandu',
});
const timestampFormat = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Kathmandu',
});

export function CreatedDate({ value }: { value?: string }) {
  const date = value ? new Date(value) : undefined;
  if (!date || !Number.isFinite(date.getTime()))
    return <span className="record-created-date">Created date unavailable</span>;
  return (
    <span className="record-created-date">
      Created{' '}
      <time dateTime={value} title={`${timestampFormat.format(date)} · Nepal time`}>
        {dateFormat.format(date)}
      </time>
    </span>
  );
}
