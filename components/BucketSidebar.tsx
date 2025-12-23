"use client";

import { useEffect, useState } from "react";
import { Bucket } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, MessageSquare, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MessageListRef } from "@/components/MessageList";

interface BucketSidebarProps {
  messageListRef: React.RefObject<MessageListRef>;
}

export function BucketSidebar({
  messageListRef,
}: BucketSidebarProps) {
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [newBucketName, setNewBucketName] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchBuckets = async () => {
    try {
      const response = await fetch("/api/buckets");
      const data = await response.json();
      setBuckets(data.buckets || []);
    } catch (error) {
      console.error("Error fetching buckets:", error);
    }
  };

  useEffect(() => {
    fetchBuckets();
    // Poll for updates every 2 seconds (since we're using in-memory store)
    const interval = setInterval(fetchBuckets, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCreateBucket = async () => {
    if (!newBucketName.trim()) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/buckets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newBucketName }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewBucketName("");
        setIsDialogOpen(false);
        // Scroll to the newly created bucket
        if (messageListRef.current) {
          setTimeout(() => {
            messageListRef.current?.scrollToBucket(data.bucket.id);
          }, 500);
        }
        fetchBuckets();
      }
    } catch (error) {
      console.error("Error creating bucket:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBucket = async (bucketId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this bucket?")) return;

    try {
      const response = await fetch(`/api/buckets?id=${bucketId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchBuckets();
      }
    } catch (error) {
      console.error("Error deleting bucket:", error);
    }
  };

  const handleBucketClick = (bucketId: string) => {
    if (messageListRef.current) {
      messageListRef.current.scrollToBucket(bucketId);
    }
  };

  return (
    <div className="w-64 border-r bg-muted/40 flex flex-col h-full">
      <div className="p-4 border-b">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="default">
              <Plus className="mr-2 h-4 w-4" />
              New Bucket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Bucket</DialogTitle>
              <DialogDescription>
                Create a new conversation bucket to organize your chats.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder="Bucket name..."
                value={newBucketName}
                onChange={(e) => setNewBucketName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateBucket();
                  }
                }}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleCreateBucket}
                disabled={isLoading || !newBucketName.trim()}
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2">
          {buckets.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No buckets yet. Create one to get started!
            </div>
          ) : (
            buckets.map((bucket) => (
              <div
                key={bucket.id}
                className="group relative mb-2 p-3 rounded-lg cursor-pointer transition-colors bg-background hover:bg-accent"
                onClick={() => handleBucketClick(bucket.id)}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {bucket.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => handleDeleteBucket(bucket.id, e)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

