// Layout de las páginas de auth: centra el contenido. Aditivo — no toca el layout global.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
