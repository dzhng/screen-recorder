import Foundation
import CoreGraphics
import CoreVideo
import CryptoKit
@main struct Main {
 static func main() throws {
  let data=try Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]));let width=256,height=160
  guard data.count == width * height * 4 else { throw CocoaError(.fileReadCorruptFile) }
  let color=CVImageBufferCreateColorSpaceFromAttachments([kCVImageBufferColorPrimariesKey:kCVImageBufferColorPrimaries_ITU_R_709_2,kCVImageBufferTransferFunctionKey:kCVImageBufferTransferFunction_ITU_R_709_2,kCVImageBufferYCbCrMatrixKey:kCVImageBufferYCbCrMatrix_ITU_R_709_2] as CFDictionary)!.takeRetainedValue()
  let image=CGImage(width:width,height:height,bitsPerComponent:8,bitsPerPixel:32,bytesPerRow:width*4,space:color,bitmapInfo:CGBitmapInfo(rawValue:CGImageAlphaInfo.premultipliedFirst.rawValue|CGBitmapInfo.byteOrder32Little.rawValue),provider:CGDataProvider(data:data as CFData)!,decode:nil,shouldInterpolate:false,intent:.defaultIntent)!
  let context=CGContext(data:nil,width:width,height:height,bitsPerComponent:8,bytesPerRow:width*4,space:CGColorSpace(name:CGColorSpace.sRGB)!,bitmapInfo:CGImageAlphaInfo.premultipliedLast.rawValue|CGBitmapInfo.byteOrder32Big.rawValue)!
  context.draw(image,in:CGRect(x:0,y:0,width:width,height:height));try Data(bytes:context.data!,count:data.count).write(to:URL(fileURLWithPath:CommandLine.arguments[2]));print(SHA256.hash(data:color.copyICCData()! as Data).map{String(format:"%02x",$0)}.joined())
 }
}
