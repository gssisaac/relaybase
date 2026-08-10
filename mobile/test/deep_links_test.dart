import 'package:flutter_test/flutter_test.dart';

import 'package:relaybase/config/deep_links.dart';

void main() {
  group('ConnectDeepLink', () {
    test('parses a valid connect deep link', () {
      const uri = 'relaybase://connect?workerUrl=https://worker.example.com&password=secret123';
      final params = ConnectDeepLink.parse(uri);
      expect(params, isNotNull);
      expect(params!.workerUrl, 'https://worker.example.com');
      expect(params.password, 'secret123');
    });

    test('returns null for a non-relaybase scheme', () {
      expect(ConnectDeepLink.parse('https://example.com'), isNull);
    });

    test('returns null when workerUrl or password is missing', () {
      expect(ConnectDeepLink.parse('relaybase://connect?workerUrl=https://x'), isNull);
      expect(ConnectDeepLink.parse('relaybase://connect?password=x'), isNull);
    });

    test('returns null for an empty string', () {
      expect(ConnectDeepLink.parse(''), isNull);
    });
  });
}
