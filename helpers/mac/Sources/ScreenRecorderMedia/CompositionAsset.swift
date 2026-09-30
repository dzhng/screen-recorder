import Foundation

/// A caller-resolved immutable asset stream. Origin preserves the shared asset clock when the
/// container's presentation timestamps do not begin at zero.
public struct CompositionAsset: Codable, Sendable {
    public let assetId: String
    public let streamId: String
    public let path: String
    public let originUs: ExactTime
}
