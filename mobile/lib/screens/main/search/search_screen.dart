import 'package:flutter/cupertino.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../providers/search_provider.dart';
import '../../../theme/colors.dart';
import '../../../theme/radii.dart';
import '../../../utils/date_format.dart';
import '../../../widgets/avatar.dart';
import '../../../widgets/empty_state.dart';
import '../../thread/thread_detail_screen.dart';

/// Full-screen search: search bar + recent chips + results list.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  final _focus = FocusNode();

  @override
  void initState() {
    super.initState();
    _focus.requestFocus();
  }

  @override
  void dispose() {
    _controller.dispose();
    _focus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(searchProvider);
    final colors = ThemeColors.of(context);
    return CupertinoPageScaffold(
      backgroundColor: colors.surface,
      child: SafeArea(
        child: Column(
          children: [
            _searchBar(colors),
            if (state.query.isEmpty) _chips(colors) else const SizedBox.shrink(),
            Expanded(child: _results(state, colors)),
          ],
        ),
      ),
    );
  }

  Widget _searchBar(ThemeColors colors) {
    return Container(
      height: 52,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          CupertinoButton(
            padding: EdgeInsets.zero,
            minSize: 40,
            onPressed: () => Navigator.of(context).pop(),
            child: const Icon(CupertinoIcons.back, size: 24),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: CupertinoTextField(
              controller: _controller,
              focusNode: _focus,
              placeholder: 'Search mail',
              autocorrect: false,
              prefix: Padding(
                padding: const EdgeInsets.only(left: 8),
                child: Icon(CupertinoIcons.search, size: 18, color: colors.onSurfaceVariant),
              ),
              suffix: _controller.text.isEmpty
                  ? null
                  : CupertinoButton(
                      padding: EdgeInsets.zero,
                      minSize: 0,
                      onPressed: () {
                        _controller.clear();
                        ref.read(searchProvider.notifier).updateQuery('');
                      },
                      child: Icon(CupertinoIcons.xmark_circle_fill, size: 18, color: colors.onSurfaceVariant),
                    ),
              onChanged: (v) {
                ref.read(searchProvider.notifier).updateQuery(v);
                setState(() {});
              },
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: AppRadii.field,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _chips(ThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          _chip('From', colors),
          _chip('To', colors),
          _chip('Attachment', colors),
          _chip('Date', colors),
        ],
      ),
    );
  }

  Widget _chip(String label, ThemeColors colors) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadii.button,
        border: Border.all(color: colors.divider),
      ),
      child: Text(label, style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant)),
    );
  }

  Widget _results(SearchState state, ThemeColors colors) {
    if (state.query.isEmpty) {
      return const EmptyState(
        icon: CupertinoIcons.search,
        title: 'Search your mail',
        subtitle: 'Find messages by sender, subject, or content.',
      );
    }
    if (state.searching) {
      return const Center(child: CupertinoActivityIndicator());
    }
    if (state.results.isEmpty) {
      return EmptyState(
        icon: CupertinoIcons.search,
        title: 'No results for “${state.query}”',
      );
    }
    return ListView.separated(
      itemCount: state.results.length,
      separatorBuilder: (_, __) => Container(margin: const EdgeInsets.only(left: 72), height: 0.5, color: colors.divider),
      itemBuilder: (context, index) {
        final m = state.results[index];
        return CupertinoButton(
          padding: EdgeInsets.zero,
          minSize: 0,
          onPressed: () => Navigator.of(context).push(
            CupertinoPageRoute<void>(builder: (_) => ThreadDetailScreen(message: m)),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Avatar(initials: _initials(m.fromEmail), email: m.fromEmail, size: 40),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              m.fromEmail,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.onSurface),
                            ),
                          ),
                          Text(
                            DateFormatter.format(m.receivedAtDateTime),
                            style: TextStyle(fontSize: 12, color: colors.onSurfaceVariant),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        m.subject,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 14, color: colors.onSurface),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        m.preview,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _initials(String from) {
    final name = from.split('<').first.trim();
    final source = name.isEmpty ? from : name;
    final parts = source.split(RegExp(r'[\s@_.]+')).where((p) => p.isNotEmpty).toList();
    if (parts.length >= 2) {
      return '${parts.first[0]}${parts[1][0]}'.toUpperCase();
    }
    return source.length >= 2 ? source.substring(0, 2).toUpperCase() : source.toUpperCase();
  }
}
