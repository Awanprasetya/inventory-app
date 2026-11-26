import 'package:flutter/material.dart';

class StatusBadge extends StatelessWidget {
  final String status;
  final bool small;

  const StatusBadge({
    super.key,
    required this.status,
    this.small = false,
  });

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    String label = status;

    switch (status.toUpperCase()) {
      case 'AVAILABLE':
        bg = const Color(0xFFDCFCE7);
        fg = const Color(0xFF166534);
        label = 'Tersedia';
        break;
      case 'QUARANTINE':
        bg = const Color(0xFFFEF3C7);
        fg = const Color(0xFF92400E);
        label = 'Karantina';
        break;
      case 'HOLD':
        bg = const Color(0xFFFEE2E2);
        fg = const Color(0xFF991B1B);
        label = 'Ditahan';
        break;
      case 'EXPIRED':
        bg = const Color(0xFF7F1D1D);
        fg = Colors.white;
        label = 'Kedaluwarsa';
        break;
      case 'MASUK':
        bg = const Color(0xFFDBEAFE);
        fg = const Color(0xFF1E40AF);
        label = 'Masuk';
        break;
      case 'KELUAR':
        bg = const Color(0xFFFFEDD5);
        fg = const Color(0xFF9A3412);
        label = 'Keluar';
        break;
      case 'APPROVED':
        bg = const Color(0xFFE0E7FF);
        fg = const Color(0xFF3730A3);
        label = 'Disetujui';
        break;
      case 'COMPLETED':
        bg = const Color(0xFFD1FAE5);
        fg = const Color(0xFF065F46);
        label = 'Selesai';
        break;
      default:
        bg = const Color(0xFFF1F5F9);
        fg = const Color(0xFF475569);
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: small ? 8 : 10,
        vertical: small ? 2 : 4,
      ),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: fg.withOpacity(0.2)),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: small ? 11 : 12,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
