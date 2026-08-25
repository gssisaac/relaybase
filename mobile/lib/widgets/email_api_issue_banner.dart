import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/email_api_issue_provider.dart';
import '../theme/colors.dart';
import '../utils/email_api_error.dart';

/// Fixed header strip for the email-API-not-configured send failure.
class EmailApiIssueBanner extends ConsumerWidget {
  const EmailApiIssueBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(emailApiIssueProvider)) return const SizedBox.shrink();
    final colors = ThemeColors.of(context);
    return Container(
      width: double.infinity,
      color: colors.delete.withValues(alpha: 0.12),
      padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Text(
              emailApiIssueTeammateCopy,
              style: TextStyle(fontSize: 13, height: 1.3, color: colors.delete),
            ),
          ),
          CupertinoButton(
            padding: const EdgeInsets.all(4),
            minimumSize: const Size(32, 32),
            onPressed: () => ref.read(emailApiIssueProvider.notifier).state = false,
            child: Icon(CupertinoIcons.xmark, size: 16, color: colors.delete),
          ),
        ],
      ),
    );
  }
}
