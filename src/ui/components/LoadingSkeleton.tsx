export default function LoadingSkeleton() {
  return (
    <div className="bg-white shadow-sm p-4 rounded-lg mr-auto max-w-[80%] border border-gray-100 font-apple animate-pulse">
      <div className="flex items-center gap-2 mb-1">
        <div className="h-5 w-5 bg-gray-200 rounded" />
        <div className="h-4 w-24 bg-gray-200 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-4 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}
