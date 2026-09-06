export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-5xl" aria-hidden>
        🛒
      </span>
      <h1 className="font-heading text-2xl font-bold">הסל שלנו</h1>
      <p className="text-muted-foreground">רשימת הקניות המשותפת של המשפחה.</p>
    </main>
  );
}
