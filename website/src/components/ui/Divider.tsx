export default function Divider({ inset = 16 }: { inset?: number }) {
  return (
    <div
      className="h-px bg-border"
      style={{ marginLeft: inset, marginRight: inset }}
    />
  );
}