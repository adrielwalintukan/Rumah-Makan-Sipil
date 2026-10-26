# Isi SUPABASE_ACCESS_TOKEN (akun Rumah Makan Sipil) hanya untuk terminal ini.
# Wajib di-dot-source:  . .\scripts\use-supabase-token.ps1
# Kompatibel PowerShell 5.1. Token tidak ditampilkan, tidak disimpan ke file,
# dan bukan environment variable Windows permanen.

if ($MyInvocation.InvocationName -ne '.') {
    Write-Warning "Jalankan dengan titik di depan:  . .\scripts\use-supabase-token.ps1"
    Write-Warning "Tanpa titik, variabel token hilang begitu script selesai."
    return
}

$secure = Read-Host "Token Supabase Rumah Makan Sipil" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
try {
    $env:SUPABASE_ACCESS_TOKEN = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    Remove-Variable secure, bstr -ErrorAction SilentlyContinue
}

if ([string]::IsNullOrWhiteSpace($env:SUPABASE_ACCESS_TOKEN)) {
    Remove-Item Env:SUPABASE_ACCESS_TOKEN -ErrorAction SilentlyContinue
    Write-Warning "Token kosong. SUPABASE_ACCESS_TOKEN tidak diisi."
} else {
    Write-Host "SUPABASE_ACCESS_TOKEN terisi untuk terminal ini saja. Cek dengan: npx supabase projects list"
}
