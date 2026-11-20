/** Template dirender ulang tiap pindah rute, jadi animasi masuk berjalan pada setiap halaman pelanggan. */
export default function PelangganTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page-in flex flex-1 flex-col">{children}</div>;
}
