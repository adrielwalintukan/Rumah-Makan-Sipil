export default function PelangganLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div aria-hidden className="ambient" />
      {children}
    </>
  );
}
