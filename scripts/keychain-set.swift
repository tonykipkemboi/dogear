import Foundation
import Security

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write(Data("usage: keychain-set <service> <account>\n".utf8))
    exit(2)
}

let service = args[1]
let account = args[2]
let input = FileHandle.standardInput.readDataToEndOfFile()
guard let raw = String(data: input, encoding: .utf8) else {
    exit(2)
}

let secret = raw.trimmingCharacters(in: .whitespacesAndNewlines)
guard !secret.isEmpty else {
    exit(2)
}

let base: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: service,
    kSecAttrAccount as String: account,
    kSecAttrLabel as String: "Dogear",
]

SecItemDelete(base as CFDictionary)

var trusted: CFArray?
var app: SecTrustedApplication?
if SecTrustedApplicationCreateFromPath("/usr/bin/security", &app) == errSecSuccess, let app = app {
    trusted = [app] as CFArray
}

var access: SecAccess?
SecAccessCreate("Dogear" as CFString, trusted, &access)

var item = base
item[kSecValueData as String] = secret.data(using: .utf8)!
if let access = access {
    item[kSecAttrAccess as String] = access
}

let status = SecItemAdd(item as CFDictionary, nil)
exit(status == errSecSuccess ? 0 : 1)
