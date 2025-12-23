"use client";

interface SystemDividerProps {
  bucketName: string;
}

export function SystemDivider({ bucketName }: SystemDividerProps) {
  return (
    <div className="flex items-center gap-4 my-4">
      <div className="flex-1 border-t border-border/50"></div>
      <span className="text-xs text-muted-foreground whitespace-nowrap">
        --- Context switched to: {bucketName} ---
      </span>
      <div className="flex-1 border-t border-border/50"></div>
    </div>
  );
}

