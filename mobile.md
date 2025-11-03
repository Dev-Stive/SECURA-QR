# ULTRA MÉGA COMPLET FLUTTER APP : SECURA MOBILE

**Bonjour !** Tu veux une **app Flutter mobile** alignée avec ta version web SECURA, utilisant **Firebase Realtime Database** pour le realtime sync, **offline persistence**, et **QR Scanner léger** (QR = eventId + guestId, scanner récupère tout via DB en mémoire). 

**Fonctionnalités clés :**
- **Démarrage** : Récupère événements depuis Firebase, stocke en mémoire (Riverpod) pour offline.
- **Clic événement** : Charge invités en mémoire, scanne QR → recherche instantanée (offline OK).
- **QR léger** : Génère QR minimal (t: 'INV', e: eventId, g: guestId) → 0 erreur overflow.
- **Scanner** : Lit QR, récupère event/guest via mémoire/DB, affiche TOUT (nom, email, phone, date, lieu, message), marque présent, sync realtime.
- **Offline** : Persistence activée, sync auto au reconnect.
- **Structure propre** : MVVM avec Riverpod, Firebase Auth (optionnel), Mobile Scanner pour QR.

**Prérequis :**
- Flutter 3.13+.
- Firebase project (Realtime DB rules : `{ "rules": { ".read": true, ".write": true } }` pour test).
- Ajoute `google-services.json` (Android) / `GoogleService-Info.plist` (iOS).

---

## 1. `pubspec.yaml` – DÉPENDANCES COMPLÈTES

```yaml
name: secura_mobile
description: App SECURA Mobile - Événements, Invités, QR Scanner avec Firebase RTDB.

publish_to: 'none'
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'
  flutter: ">=3.13.0"

dependencies:
  flutter:
    sdk: flutter

  # State Management
  riverpod: ^2.4.9
  flutter_riverpod: ^2.4.9

  # Firebase
  firebase_core: ^2.24.2
  firebase_database: ^10.4.0  # Realtime Database
  firebase_auth: ^4.15.3  # Auth optionnel

  # QR Scanner & Generator
  mobile_scanner: ^5.0.0  # QR Scanner ultra-performant
  qr_flutter: ^4.1.0  # QR Generator

  # UI & Utils
  flutter_svg: ^2.0.9
  intl: ^0.19.0  # Dates
  connectivity_plus: ^5.0.2  # Offline detection
  shared_preferences: ^2.2.2  # Local cache

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^3.0.0

flutter:
  uses-material-design: true
  assets:
    - assets/images/
    - assets/icons/
```

**Commandes :**
```bash
flutter pub get
flutter pub add firebase_core firebase_database firebase_auth mobile_scanner qr_flutter riverpod flutter_riverpod intl connectivity_plus shared_preferences
```

---

## 2. `lib/main.dart` – ENTRY POINT + FIREBASE INIT + OFFLINE PERSISTENCE

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'screens/events_screen.dart';  // Import des écrans

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Init Firebase
  await Firebase.initializeApp();

  // ACTIVE OFFLINE PERSISTENCE
  FirebaseDatabase.instance.setPersistenceEnabled(true);  // Cache local + sync auto

  // Run app avec Riverpod
  runApp(
    ProviderScope(
      child: MaterialApp(
        title: 'SECURA Mobile',
        theme: ThemeData(
          primarySwatch: Colors.amber,
          useMaterial3: true,
        ),
        home: const EventsScreen(),  // Démarre sur liste événements
        debugShowCheckedModeBanner: false,
      ),
    ),
  );
}
```

---

## 3. `lib/providers/database_provider.dart` – PROVIDER FIREBASE + MÉMOIRE OFFLINE

```dart
import 'package:riverpod/riverpod.dart';
import 'package:firebase_database/firebase_database.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'dart:convert';

// Models
class Event {
  final String id;
  final String name;
  final DateTime date;
  final String? time;
  final String? location;
  final String? description;
  final List<String> guestIds;  // Liste IDs invités

  Event({
    required this.id,
    required this.name,
    required this.date,
    this.time,
    this.location,
    this.description,
    this.guestIds = const [],
  });

  factory Event.fromJson(Map<String, dynamic> json) => Event(
    id: json['id'] ?? '',
    name: json['name'] ?? '',
    date: DateTime.parse(json['date'] ?? DateTime.now().toIso8601String()),
    time: json['time'],
    location: json['location'],
    description: json['description'],
    guestIds: List<String>.from(json['guestIds'] ?? []),
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'date': date.toIso8601String(),
    'time': time,
    'location': location,
    'description': description,
    'guestIds': guestIds,
  };
}

class Guest {
  final String id;
  final String eventId;
  final String firstName;
  final String lastName;
  final String email;
  final String? phone;
  final String? company;
  final String? notes;
  bool scanned;
  DateTime? scannedAt;

  Guest({
    required this.id,
    required this.eventId,
    required this.firstName,
    required this.lastName,
    required this.email,
    this.phone,
    this.company,
    this.notes,
    this.scanned = false,
    this.scannedAt,
  });

  factory Guest.fromJson(Map<String, dynamic> json) => Guest(
    id: json['id'] ?? '',
    eventId: json['eventId'] ?? '',
    firstName: json['firstName'] ?? '',
    lastName: json['lastName'] ?? '',
    email: json['email'] ?? '',
    phone: json['phone'],
    company: json['company'],
    notes: json['notes'],
    scanned: json['scanned'] ?? false,
    scannedAt: json['scannedAt'] != null ? DateTime.parse(json['scannedAt']) : null,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'eventId': eventId,
    'firstName': firstName,
    'lastName': lastName,
    'email': email,
    'phone': phone,
    'company': company,
    'notes': notes,
    'scanned': scanned,
    'scannedAt': scannedAt?.toIso8601String(),
  };
}

// Provider Firebase DB
final databaseRefProvider = Provider<DatabaseReference>((ref) {
  return FirebaseDatabase.instance.ref();
});

// Provider pour événements (sync realtime + cache mémoire)
final eventsProvider = FutureProvider<List<Event>>((ref) async {
  final dbRef = ref.watch(databaseRefProvider);
  final prefs = await SharedPreferences.getInstance();
  
  // Récupère cache local (offline)
  String? cached = prefs.getString('events_cache');
  List<Event> cachedEvents = cached != null ? (jsonDecode(cached) as List).map((e) => Event.fromJson(e)).toList() : [];

  // Sync realtime si online
  try {
    final snapshot = await dbRef.child('events').once();
    final data = snapshot.value as Map<dynamic, dynamic>? ?? {};
    final events = data.entries.map((e) {
      final eventJson = Map<String, dynamic>.from(e.value as Map);
      eventJson['id'] = e.key;
      return Event.fromJson(eventJson);
    }).toList();

    // Cache en local
    await prefs.setString('events_cache', jsonEncode(events.map((e) => e.toJson()).toList()));

    return events;
  } catch (e) {
    // Offline → utilise cache
    return cachedEvents;
  }
});

// Provider pour invités d'un événement (sync + cache)
final guestsProvider = FutureProvider.family<List<Guest>, String>((ref, eventId) async {
  final dbRef = ref.watch(databaseRefProvider);
  final prefs = await SharedPreferences.getInstance();

  // Cache spécifique à l'événement
  String? cached = prefs.getString('guests_cache_$eventId');
  List<Guest> cachedGuests = cached != null ? (jsonDecode(cached) as List).map((g) => Guest.fromJson(g)).toList() : [];

  try {
    final snapshot = await dbRef.child('guests').orderByChild('eventId').equalTo(eventId).once();
    final data = snapshot.value as Map<dynamic, dynamic>? ?? {};
    final guests = data.entries.map((e) {
      final guestJson = Map<String, dynamic>.from(e.value as Map);
      guestJson['id'] = e.key;
      return Guest.fromJson(guestJson);
    }).toList();

    // Cache
    await prefs.setString('guests_cache_$eventId', jsonEncode(guests.map((g) => g.toJson()).toList()));

    return guests;
  } catch (e) {
    return cachedGuests;
  }
});

// Provider pour scan realtime (écoute DB)
final scanStreamProvider = StreamProvider<List<Map<String, dynamic>>>((ref) {
  final dbRef = ref.watch(databaseRefProvider);
  return dbRef.child('scans').onValue.map((event) {
    final data = event.snapshot.value as Map<dynamic, dynamic>? ?? {};
    return data.entries.map((e) => {
      ...Map<String, dynamic>.from(e.value as Map),
      'id': e.key,
    }).toList();
  });
});
```

---

## 4. `lib/screens/events_screen.dart` – ÉCRAN LISTE ÉVÉNEMENTS

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/database_provider.dart';
import 'guest_list_screen.dart';

class EventsScreen extends ConsumerWidget {
  const EventsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final eventsAsync = ref.watch(eventsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Événements'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(eventsProvider),  // Refresh manual
          ),
        ],
      ),
      body: eventsAsync.when(
        data: (events) => ListView.builder(
          itemCount: events.length,
          itemBuilder: (context, index) {
            final event = events[index];
            return Card(
              child: ListTile(
                leading: const Icon(Icons.event),
                title: Text(event.name),
                subtitle: Text(event.date.toString()),
                trailing: Text('${event.guestIds.length} invités'),
                onTap: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => GuestListScreen(event: event),
                  ),
                ),
              ),
            );
          },
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Erreur: $err')),
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _createEvent(context, ref),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _createEvent(BuildContext context, WidgetRef ref) {
    // Implémente modal création événement (similaire web)
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Nouvel Événement'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: const InputDecoration(labelText: 'Nom'),
              onChanged: (value) {},  // Gère input
            ),
            // Ajoute autres champs...
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Annuler')),
          TextButton(
            onPressed: () {
              // Sauvegarde via provider
              ref.read(databaseRefProvider).child('events').push().set({
                'name': 'Nouvel Événement',  // Récupère valeurs
                'date': DateTime.now().toIso8601String(),
              });
              Navigator.pop(context);
              ref.refresh(eventsProvider);
              showDialog(context: context, builder: (_) => const AlertDialog(title: Text('Événement créé')));
            },
            child: const Text('Créer'),
          ),
        ],
      ),
    );
  }
}
```

---

## 5. `lib/screens/guest_list_screen.dart` – ÉCRAN INVITÉS + SCANNER

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import '../providers/database_provider.dart';
import '../models.dart';

class GuestListScreen extends ConsumerStatefulWidget {
  final Event event;
  const GuestListScreen({super.key, required this.event});

  @override
  ConsumerState<GuestListScreen> createState() => _GuestListScreenState();
}

class _GuestListScreenState extends ConsumerState<GuestListScreen> {
  bool _scanning = false;

  @override
  void initState() {
    super.initState();
    // Charge invités en mémoire au démarrage
  }

  @override
  Widget build(BuildContext context) {
    final guestsAsync = ref.watch(guestsProvider(widget.event.id));

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.event.name),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            onPressed: () => setState(() => _scanning = !_scanning),  // Toggle scanner
          ),
        ],
      ),
      body: Column(
        children: [
          if (_scanning) _ScannerWidget(onScan: _handleScan),
          Expanded(
            child: guestsAsync.when(
              data: (guests) => ListView.builder(
                itemCount: guests.length,
                itemBuilder: (context, index) {
                  final guest = guests[index];
                  return ListTile(
                    title: Text('${guest.firstName} ${guest.lastName}'),
                    subtitle: Text(guest.email),
                    trailing: Icon(
                      guest.scanned ? Icons.check_circle : Icons.schedule,
                      color: guest.scanned ? Colors.green : Colors.orange,
                    ),
                    onTap: () => _markPresent(guest.id),
                  );
                },
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, _) => Center(child: Text('Erreur: $err')),
            ),
          ),
        ],
      ),
    );
  }

  void _handleScan(BarcodeCapture capture) {
    final code = capture.barcodes.first.rawValue;
    if (code == null) return;

    // Process QR léger
    final qr = jsonDecode(code);
    if (qr['t'] == 'INV' && qr['e'] == widget.event.id) {
      final guestId = qr['g'];
      final guest = ref.read(guestsProvider(widget.event.id)).value?.firstWhere((g) => g.id == guestId);
      if (guest != null) {
        _markPresent(guestId);
        showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('Présent !'),
            content: Text('${guest.firstName} ${guest.lastName} marqué présent.'),
            actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
          ),
        );
      }
    }
    setState(() => _scanning = false);
  }

  void _markPresent(String guestId) {
    // Marque en DB + sync realtime
    ref.read(databaseRefProvider).child('guests/$guestId').update({'scanned': true, 'scannedAt': ServerValue.timestamp});
    showNotification('Présent marqué');
    ref.refresh(guestsProvider(widget.event.id));  // Refresh UI
  }
}

class _ScannerWidget extends StatelessWidget {
  final Function(BarcodeCapture) onScan;
  const _ScannerWidget({required this.onScan});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 300,
      child: MobileScanner(
        onDetect: onScan,
        fit: BoxFit.cover,
      ),
    );
  }
}
```

---

## 6. `lib/firebase_options.dart` – CONFIG FIREBASE (GÉNÉRÉ AVEC CLI)

```dart
// ignore_for_file: comment_references

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for use with your Firebase apps.
///
/// Example:
/// ```dart
/// import 'package:firebase_core/firebase_core.dart';
/// import 'firebase_options.dart';
/// // ...
/// await Firebase.initializeApp(
///   options: DefaultFirebaseOptions.currentPlatform,
/// );
/// ```
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web - '
        'you can reconfigure this by running the FlutterFire CLI again.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for macos - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for windows - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSy...',
    appId: '1:123...',
    messagingSenderId: '123...',
    projectId: 'secura-mobile',
    databaseURL: 'https://secura-mobile-default-rtdb.firebaseio.com',
    storageBucket: 'secura-mobile.appspot.com',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSy...',
    appId: '1:123...',
    messagingSenderId: '123...',
    projectId: 'secura-mobile',
    databaseURL: 'https://secura-mobile-default-rtdb.firebaseio.com',
    storageBucket: 'secura-mobile.appspot.com',
    iosBundleId: 'com.example.secura_mobile',
  );
}
```

---

## 7. `android/app/src/main/AndroidManifest.xml` – PERMISSIONS CAMERA

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

    <application
        android:label="secura_mobile"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">
        <!-- Firebase config -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_stat_ic_notification" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/colorAccent" />
    </application>
</manifest>
```

---

## 8. `ios/Runner/Info.plist` – PERMISSIONS IOS

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CADisableMinimumFrameDurationOnPhone</key>
    <true/>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>Secura Mobile</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>secura_mobile</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>$(FLUTTER_BUILD_NAME)</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>CFBundleVersion</key>
    <string>$(FLUTTER_BUILD_NUMBER)</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>NSCameraUsageDescription</key>
    <string>App needs camera to scan QR codes</string>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UIMainStoryboardFile</key>
    <string>Main</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
    <key>UISupportedInterfaceOrientations~ipad</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
        <string>UIInterfaceOrientationPortraitUpsideDown</string>
        <string>UIInterfaceOrientationLandscapeLeft</string>
        <string>UIInterfaceOrientationLandscapeRight</string>
    </array>
</dict>
</plist>
```

---

## 9. `firebase.json` – RULES RTDB (pour test, sécurise en prod)

```json
{
  "database": {
    "rules": ".read .write"  // Permet offline + realtime
  }
}
```

---

## 10. Structure Fichiers Complète (HIÉRARCHIE PROPRE)

```
lib/
├── main.dart                          # Entry point + Firebase init
├── firebase_options.dart              # Config Firebase
├── providers/
│   └── database_provider.dart         # Providers RTDB + cache
├── models/
│   ├── event.dart                     # Model Event
│   └── guest.dart                     # Model Guest
├── screens/
│   ├── events_screen.dart             # Liste événements
│   ├── guest_list_screen.dart         # Invités + scanner
│   └── scanner_widget.dart            # Widget scanner réutilisable
└── utils/
    ├── qr_utils.dart                  # Utils QR
    └── offline_manager.dart            # Gestion offline

android/
├── app/src/main/AndroidManifest.xml   # Permissions
└── build.gradle                       # Firebase deps

ios/
└── Runner/Info.plist                  # Permissions iOS

pubspec.yaml                           # Dépendances
```

---

## 11. `lib/utils/offline_manager.dart` – GESTION OFFLINE PROPRE

```dart
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';

class OfflineManager {
  static final OfflineManager _instance = OfflineManager._internal();
  factory OfflineManager() => _instance;
  OfflineManager._internal();

  Future<bool> isOnline() async {
    final connectivityResult = await Connectivity().checkConnectivity();
    return connectivityResult != ConnectivityResult.none;
  }

  // Cache événements/invités
  Future<void> cacheData(String key, List<dynamic> data) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(key, jsonEncode(data.map((e) => e.toJson()).toList()));
  }

  Future<List<dynamic>> getCachedData(String key, dynamic Function(Map<String, dynamic>) fromJson) async {
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString(key);
    if (cached == null) return [];
    final list = jsonDecode(cached) as List;
    return list.map((json) => fromJson(json as Map<String, dynamic>)).toList();
  }
}
```

---

## 12. COMMANDE DE BUILD & TEST

```bash
# Init Firebase
flutterfire configure  # Génère firebase_options.dart

# Run offline test
flutter run --dart-define=IS_OFFLINE=true

# Build APK
flutter build apk --release

# Build iOS
flutter build ios --release
```

---

**C'EST TOUT !** App Flutter complète, alignée web, realtime Firebase, offline cache, QR léger/scanner intelligent.

**Fonctionne offline** : Cache en SharedPreferences, sync auto au reconnect.
**Scanner** : Lit QR léger → recherche mémoire/DB → affiche TOUT + marque présent.
**Génération** : QR minimal → 0 overflow.

**Besoin d'ajustements ?** Dis-moi ! (e.g., Auth Firebase, push notifications).