#import "ReaderObservation.h"
#import <AVFoundation/AVFoundation.h>
#import <objc/runtime.h>

static NSLock *lock;
static NSHashTable<AVAssetReader *> *readers;
static void (^notification)(void);
static IMP original, replacement;
static Method method;
static NSUInteger calls, active;
static BOOL signaled;
static NSString *encoding;

BOOL CameraReadersObserve(void (^signal)(void), NSError **error) {
    method = class_getInstanceMethod(AVAssetReader.class, @selector(startReading));
    NSMethodSignature *signature = [NSMethodSignature signatureWithObjCTypes:method_getTypeEncoding(method)];
    if (signature.numberOfArguments != 2 || strcmp(signature.methodReturnType, @encode(BOOL)) != 0 ||
        strcmp([signature getArgumentTypeAtIndex:0], "@") != 0 || strcmp([signature getArgumentTypeAtIndex:1], ":") != 0) {
        if (error) *error = [NSError errorWithDomain:@"CameraReaderObservation" code:1 userInfo:@{NSLocalizedDescriptionKey:@"Unsupported startReading ABI"}];
        return NO;
    }
    encoding = @(method_getTypeEncoding(method));
    original = method_getImplementation(method);
    lock = [NSLock new]; readers = [NSHashTable weakObjectsHashTable]; notification = [signal copy];
    replacement = imp_implementationWithBlock(^BOOL(AVAssetReader *reader) {
        [lock lock]; active += 1; [lock unlock];
        BOOL started = ((BOOL (*)(id, SEL))original)(reader, @selector(startReading));
        void (^notify)(void) = nil;
        AVAsset *asset = reader.asset;
        if ([asset isKindOfClass:AVURLAsset.class]) {
            NSString *name = ((AVURLAsset *)asset).URL.lastPathComponent;
            if ([name isEqual:@"camera.raw.mov"] || [name isEqual:@"camera.mov"]) {
                [lock lock]; calls += 1; [readers addObject:reader];
                BOOL raw = NO, canonical = NO;
                for (AVAssetReader *tracked in readers.allObjects) {
                    if (tracked.status != AVAssetReaderStatusReading) continue;
                    NSString *path = ((AVURLAsset *)tracked.asset).URL.lastPathComponent;
                    raw |= [path isEqual:@"camera.raw.mov"];
                    canonical |= [path isEqual:@"camera.mov"];
                }
                if (raw && canonical && !signaled) { signaled = YES; notify = notification; }
                [lock unlock];
            }
        }
        if (notify) notify();
        [lock lock]; active -= 1; [lock unlock];
        return started;
    });
    method_setImplementation(method, replacement);
    return YES;
}

NSDictionary *CameraReadersFinish(void) {
    [lock lock];
    NSMutableArray *states = [NSMutableArray array];
    NSUInteger reading = 0;
    for (AVAssetReader *reader in readers.allObjects) {
        reading += reader.status == AVAssetReaderStatusReading;
        [states addObject:@{@"source":((AVURLAsset *)reader.asset).URL.lastPathComponent, @"status":@(reader.status)}];
    }
    BOOL inactive = active == 0;
    BOOL owned = method_getImplementation(method) == replacement;
    if (inactive && owned) method_setImplementation(method, original);
    BOOL restored = method_getImplementation(method) == original;
    NSDictionary *result = @{@"encoding":encoding, @"calls":@(calls), @"active":@(active),
        @"bothReadingObserved":@(signaled), @"readingAfterJoin":@(reading), @"remainingObjects":states,
        @"restored":@(restored), @"originalDispatchDelegated":@(calls)};
    notification = nil;
    [lock unlock];
    if (inactive && restored) imp_removeBlock(replacement);
    return result;
}
