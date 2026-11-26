import Swal from 'sweetalert2';

// Toast mixin untuk notifikasi cepat di sudut kanan atas
export const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.onmouseenter = Swal.stopTimer;
    toast.onmouseleave = Swal.resumeTimer;
  },
});

/**
 * Notifikasi popup berhasil disimpan / diubah
 */
export const alertSuccess = (title = 'Berhasil!', text = 'Data berhasil disimpan') => {
  return Swal.fire({
    icon: 'success',
    title,
    text,
    timer: 2200,
    showConfirmButton: false,
    timerProgressBar: true,
  });
};

/**
 * Toast notifikasi cepat berhasil
 */
export const toastSuccess = (title = 'Berhasil disimpan!') => {
  return Toast.fire({
    icon: 'success',
    title,
  });
};

/**
 * Notifikasi popup gagal / error
 */
export const alertError = (title = 'Gagal!', text = 'Terjadi kesalahan') => {
  return Swal.fire({
    icon: 'error',
    title,
    text,
    confirmButtonText: 'Tutup',
    confirmButtonColor: '#ef4444',
  });
};

/**
 * Dialog konfirmasi sebelum menghapus data
 * Mengembalikan true jika user klik "Ya, Hapus!", false jika batal
 */
export const confirmDelete = async ({
  title = 'Apakah Anda yakin?',
  text = 'Data yang dihapus tidak dapat dikembalikan!',
  confirmButtonText = 'Ya, Hapus!',
  cancelButtonText = 'Batal',
} = {}) => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#64748b',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
};

/**
 * Dialog konfirmasi untuk aksi umum (misal ubah status, batalkan, dll)
 */
export const confirmAction = async ({
  title = 'Konfirmasi Tindakan',
  text = 'Lanjutkan tindakan ini?',
  confirmButtonText = 'Ya, Lanjutkan',
  cancelButtonText = 'Batal',
  icon = 'question',
  confirmButtonColor = '#2563eb',
} = {}) => {
  const result = await Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonColor,
    cancelButtonColor: '#64748b',
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export default Swal;

