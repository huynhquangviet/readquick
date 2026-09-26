import { BookOpen } from "lucide-react";

export default function LibraryPage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-bold text-2xl">Library</h1>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <BookOpen className="text-muted-foreground" size={32} />
        <p className="font-medium">Your Library is empty</p>
        <p className="text-sm text-muted-foreground">
          Upload a Document to start reading.
        </p>
      </div>
    </div>
  );
}
