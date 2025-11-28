interface LinkPhaseProps {
  // placeholder for linking replacements and buffers
  assignedList: Array<{ facultyId: string; role: string }>;
}

export function LinkPhase({ assignedList }: LinkPhaseProps) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">
        Link replacements and buffer faculty to absentees (UI to be
        implemented).
      </p>
      <div className="mt-4">
        {assignedList.map((a) => (
          <div key={a.facultyId} className="rounded border p-2">
            {a.facultyId} • {a.role}
          </div>
        ))}
      </div>
    </div>
  );
}
