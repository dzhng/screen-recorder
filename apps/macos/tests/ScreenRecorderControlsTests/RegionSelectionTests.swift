import CoreGraphics
import ScreenRecorderControls

func runRegionSelectionTests() {
    let screen = CGSize(width: 1440, height: 900)
    // A drag from near the bottom left up to the middle of the display.
    let chosen = RegionGeometry.region(
        from: CGPoint(x: 100, y: 100), to: CGPoint(x: 500, y: 400), inDisplayOfSize: screen)
    precondition(
        chosen == CGRect(x: 100, y: 500, width: 400, height: 300),
        "A selection is stated in the display's own points measured down from its top edge")
    precondition(
        RegionGeometry.region(
            from: CGPoint(x: 500, y: 400), to: CGPoint(x: 100, y: 100), inDisplayOfSize: screen)
            == chosen,
        "Dragging the other way selects the same rectangle")
    precondition(
        RegionGeometry.region(
            from: CGPoint(x: -200, y: -50), to: CGPoint(x: 400, y: 300), inDisplayOfSize: screen)
            == CGRect(x: 0, y: 600, width: 400, height: 300),
        "A drag that leaves the display selects up to its edge, never outside it")
    precondition(
        RegionGeometry.region(
            from: CGPoint(x: 10, y: 10), to: CGPoint(x: 14, y: 300), inDisplayOfSize: screen) == nil,
        "A drag too narrow to be a rectangle selects nothing")
    precondition(
        RegionGeometry.highlight(from: CGPoint(x: 500, y: 400), to: CGPoint(x: 100, y: 100))
            == CGRect(x: 100, y: 100, width: 400, height: 300),
        "What is highlighted while dragging is the rectangle being selected")
    print("PASS a region drag becomes display-local capture coordinates")
}
