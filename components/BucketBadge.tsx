"use client";

interface BucketBadgeProps {
  bucketName: string;
}

export function BucketBadge({ bucketName }: BucketBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-muted/60 text-muted-foreground border border-border/50">
      <span>🏷️</span>
      {bucketName}
    </span>
  );
}

