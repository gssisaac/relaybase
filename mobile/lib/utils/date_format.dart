/// Gmail-style relative timestamp formatting.
class DateFormatter {
  const DateFormatter._();

  static String format(DateTime date) {
    final now = DateTime.now();
    final local = date.toLocal();
    final diff = now.difference(local);

    if (diff.inMinutes < 1) return 'now';
    if (diff.inHours < 1) return '${diff.inMinutes}m';
    if (diff.inDays < 1) return '${diff.inHours}h';
    if (diff.inDays < 7) {
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return days[local.weekday - 1];
    }
    if (local.year == now.year) {
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      return '${months[local.month - 1]} ${local.day}';
    }
    return '${local.day}/${local.month}/${local.year}';
  }
}
