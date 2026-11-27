import SwiftUI
import SafariServices

private let publicShop = URL(string: "https://www.neejee.com")!
private let wine = Color(red: 0.45, green: 0.20, blue: 0.21)
private let paper = Color(red: 0.98, green: 0.96, blue: 0.92)

struct Destination: Identifiable {
    let id = UUID()
    let url: URL
}

struct Browser: UIViewControllerRepresentable {
    let destination: Destination
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let controller = SFSafariViewController(url: destination.url)
        controller.preferredBarTintColor = UIColor(paper)
        controller.preferredControlTintColor = UIColor(wine)
        controller.dismissButtonStyle = .close
        return controller
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

struct AppHome: View {
    private let reviewHosts: Set<String> = {
        guard let file = Bundle.main.url(forResource: "review-hosts", withExtension: "txt"),
              let hosts = try? String(contentsOf: file, encoding: .utf8) else { return [] }
        return Set(hosts.components(separatedBy: .newlines).filter { !$0.isEmpty })
    }()
    @AppStorage("shopOrigin") private var storedOrigin = publicShop.absoluteString
    @State private var destination: Destination?
    @State private var showReview = false
    @State private var reviewText = ""
    @State private var invalid = false

    private func permitted(_ url: URL) -> Bool {
        guard let parts = URLComponents(url: url, resolvingAgainstBaseURL: false), parts.scheme?.lowercased() == "https",
              parts.user == nil, parts.password == nil, parts.port == nil, let host = parts.host?.lowercased() else { return false }
        return host == "www.neejee.com" || host == "neejee.com" || reviewHosts.contains(host)
    }
    private func open(_ path: String) {
        let saved = URL(string: storedOrigin)
        let root = saved.flatMap { permitted($0) ? $0 : nil } ?? publicShop
        if let url = URL(string: path, relativeTo: root)?.absoluteURL { destination = Destination(url: url) }
    }
    private func entry(_ title: String, primary: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title).font(.body.weight(primary ? .semibold : .regular)).frame(maxWidth: .infinity, minHeight: 46)
                .foregroundStyle(primary ? Color.white : Color.black)
                .background(primary ? wine : Color(red: 0.95, green: 0.92, blue: 0.85))
                .clipShape(RoundedRectangle(cornerRadius: 5))
        }
    }
    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Image("Wordmark").resizable().scaledToFit().frame(height: 40).padding(.vertical, 15)
                    .accessibilityLabel("Neejee. Found. Personal.")
                Rectangle().fill(paper).frame(height: 245)
                    .overlay { Image("Surkh").resizable().scaledToFill() }.clipped()
                    .accessibilityLabel("Surkh, a vermilion saree with gold checks.")
                VStack(alignment: .leading, spacing: 9) {
                    Text("Sarees, suits & objects").font(.system(.title, design: .serif)).padding(.bottom, 3)
                    entry("Enter the shop", primary: true) { open("/") }
                    entry("Try a saree with Aaina") { open("/ai/mirror") }
                    entry("Shopping bag") { open("/cart") }
                    entry("My account and orders") { open("/account") }
                    entry("Staff console") { open("/admin") }
                    if !reviewHosts.isEmpty {
                        entry("Open a review link") { reviewText = ""; invalid = false; showReview = true }
                    }
                }.padding(20)
            }.frame(maxWidth: 720).frame(maxWidth: .infinity)
        }.background(paper.ignoresSafeArea())
         .preferredColorScheme(.light)
         .sheet(item: $destination) { Browser(destination: $0).ignoresSafeArea() }
         .alert("Open a review link", isPresented: $showReview) {
             TextField("Paste your Neejee review link", text: $reviewText).textInputAutocapitalization(.never).autocorrectionDisabled()
             Button("Open") {
                 let text = reviewText.trimmingCharacters(in: .whitespacesAndNewlines)
                 guard let url = URL(string: text), permitted(url), let host = url.host else { invalid = true; return }
                 storedOrigin = "https://" + host.lowercased()
                 destination = Destination(url: url)
             }
             Button("Use public shop") { storedOrigin = publicShop.absoluteString; open("/") }
             Button("Cancel", role: .cancel) {}
         }.alert("Use the approved Neejee review link supplied with this build.", isPresented: $invalid) {
             Button("Close", role: .cancel) {}
         }
    }
}

@main
struct NeejeeApp: App {
    var body: some Scene { WindowGroup { AppHome() } }
}
