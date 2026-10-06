import Foundation

/// One explicit action beside observed saved-media facts. It carries the same dispatch identity
/// and admission result wherever those facts appear.
public struct PresentedControlsAction: Equatable, Sendable {
    public init(_ action: ControlsAction, _ title: String, enabled: Bool) {
        self.action = action
        self.title = title
        self.enabled = enabled
    }
    public let action: ControlsAction
    public let title: String
    public let enabled: Bool
}

/// Read-only saved-media presentation shared by Library and native semantic probes.
public struct SavedItem: Equatable, Sendable {
    public enum Kind: Equatable, Sendable { case recording, project, export, message }
    public let id: String
    public let kind: Kind
    public let title: String
    public let status: String?
    public let details: [String]
    public let actions: [PresentedControlsAction]
    public init(id: String, kind: Kind, title: String, status: String? = nil,
                details: [String] = [], actions: [PresentedControlsAction] = []) {
        self.id = id
        self.kind = kind
        self.title = title
        self.status = status
        self.details = details
        self.actions = actions
    }
}

public struct SavedPage: Equatable, Sendable {
    public let items: [SavedItem]
    public let actions: [PresentedControlsAction]
    public init(items: [SavedItem], actions: [PresentedControlsAction] = []) {
        self.items = items
        self.actions = actions
    }
}
