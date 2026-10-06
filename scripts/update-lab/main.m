#import <Cocoa/Cocoa.h>
#import <Sparkle/Sparkle.h>
#import <objc/runtime.h>
#include <sys/file.h>
#include <fcntl.h>
#include <unistd.h>
#include <errno.h>
#include <signal.h>

@interface Lab : NSObject <NSApplicationDelegate, SPUUpdaterDelegate, SPUUserDriver>
@property SPUUpdater *updater;
@property NSString *root;
@property NSString *version;
@property NSTimer *commands;
@property(copy) void (^installReply)(SPUUserUpdateChoice);
@property BOOL busy;
@property BOOL cancelling;
@property BOOL hostControlsInstallation;
@end

@implementation Lab
- (void)record:(NSString *)event fields:(NSDictionary *)fields {
    NSMutableDictionary *value = [fields mutableCopy];
    value[@"event"] = event;
    value[@"version"] = self.version;
    NSData *data = [NSJSONSerialization dataWithJSONObject:value options:0 error:NULL];
    NSString *path = [self.root stringByAppendingPathComponent:@"events.jsonl"];
    if (![[NSFileManager defaultManager] fileExistsAtPath:path]) [[NSFileManager defaultManager] createFileAtPath:path contents:nil attributes:nil];
    NSFileHandle *file = [NSFileHandle fileHandleForWritingAtPath:path];
    [file seekToEndOfFile]; [file writeData:data]; [file writeData:[@"\n" dataUsingEncoding:NSUTF8StringEncoding]]; [file closeFile];
}
- (void)applicationDidFinishLaunching:(NSNotification *)notification {
    self.root = NSProcessInfo.processInfo.environment[@"YAP_UPDATE_LAB"] ?: NSBundle.mainBundle.infoDictionary[@"LabRoot"];
    self.version = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];
    self.busy = YES;
    self.hostControlsInstallation = [NSBundle.mainBundle.infoDictionary[@"LabHostControlsInstallation"] boolValue];
    [self record:@"launch" fields:@{@"arguments":NSProcessInfo.processInfo.arguments, @"environmentPreserved":@(NSProcessInfo.processInfo.environment[@"YAP_UPDATE_LAB"] != nil), @"executionContext":@{@"YAP_HOME":NSProcessInfo.processInfo.environment[@"YAP_HOME"] ?: NSNull.null,@"YAP_DEFAULTS":NSProcessInfo.processInfo.environment[@"YAP_DEFAULTS"] ?: NSNull.null}, @"frameworkVersion":[NSBundle bundleForClass:SPUUpdater.class].infoDictionary[@"CFBundleShortVersionString"] ?: @"missing"}];
    if ([[NSFileManager defaultManager] fileExistsAtPath:[self.root stringByAppendingPathComponent:@"stop"]]) {
        [self record:@"stoppedLaunch" fields:@{}];
        [NSApp terminate:nil];
        return;
    }
    if ([NSBundle.mainBundle.infoDictionary[@"LabScenario"] isEqualToString:@"crash"]) abort();
    self.updater = [[SPUUpdater alloc] initWithHostBundle:NSBundle.mainBundle applicationBundle:NSBundle.mainBundle userDriver:self delegate:self];
    NSError *error = nil;
    if (![self.updater startUpdater:&error]) [self record:@"error" fields:@{@"message":error.description}];
    self.commands = [NSTimer scheduledTimerWithTimeInterval:0.05 target:self selector:@selector(readCommand:) userInfo:nil repeats:YES];
}
- (void)readCommand:(NSTimer *)timer {
    NSString *path = [self.root stringByAppendingPathComponent:@"command"];
    NSString *command = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:NULL];
    if (!command) return;
    [[NSFileManager defaultManager] removeItemAtPath:path error:NULL];
    [self record:@"command" fields:@{@"command":command}];
    if ([command isEqualToString:@"check"]) [self.updater checkForUpdatesInBackground];
    else if ([command isEqualToString:@"install"] || [command isEqualToString:@"install-skip"]) {
        self.busy = NO;
        if (self.installReply) self.installReply(SPUUserUpdateChoiceInstall);
        if ([command isEqualToString:@"install-skip"]) {
            self.cancelling = YES;
            if (self.installReply) self.installReply(SPUUserUpdateChoiceSkip);
        }
    }
    else if ([command isEqualToString:@"disable"]) { self.updater.automaticallyChecksForUpdates = NO; self.cancelling = YES; if (self.installReply) { void (^reply)(SPUUserUpdateChoice) = self.installReply; self.installReply = nil; reply(SPUUserUpdateChoiceSkip); } }
    else if ([command isEqualToString:@"quit"]) [NSApp terminate:nil];
    else if ([command isEqualToString:@"probe-lock"]) [self record:@"lockProbe" fields:@{@"replacementExcluded":@([self replacementExcluded])}];
}
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    [self record:@"terminate" fields:@{@"busy":@(self.busy),@"cancelling":@(self.cancelling)}];
    if ([NSBundle.mainBundle.infoDictionary[@"LabScenario"] isEqualToString:@"unconfirmed-crash"]) return NSTerminateCancel;
    return NSTerminateNow;
}
- (BOOL)updater:(SPUUpdater *)updater shouldProceedWithUpdate:(SUAppcastItem *)item updateCheck:(SPUUpdateCheck)check error:(NSError **)error {
    NSString *format = item.propertiesDictionary[@"yapCatalogFormat"];
    BOOL accepted = item.signingValidationStatus == SPUAppcastSigningValidationStatusSucceeded && [format isEqualToString:@"23"];
    [self record:@"candidate" fields:@{@"candidateVersion":item.versionString,@"format":format ?: @"missing",@"accepted":@(accepted),@"signatureStatus":@(item.signingValidationStatus)}];
    if (!accepted && error != NULL) *error = [NSError errorWithDomain:@"YapUpdateLab" code:1 userInfo:@{NSLocalizedDescriptionKey:@"candidate format is incompatible"}];
    return accepted;
}
- (void)updater:(SPUUpdater *)updater didFinishUpdateCycleForUpdateCheck:(SPUUpdateCheck)check error:(NSError *)error {
    self.installReply = nil;
    [self record:@"cycle" fields:@{@"error":error.description ?: @"", @"replacementExcluded":@([self replacementExcluded])}];
}
- (BOOL)replacementExcluded {
    NSString *lock = [NSHomeDirectory() stringByAppendingPathComponent:NSBundle.mainBundle.infoDictionary[@"YapLaunchLockRelativePath"]];
    int descriptor = open(lock.fileSystemRepresentation, O_RDONLY | O_NOFOLLOW);
    BOOL excluded = descriptor >= 0 && flock(descriptor, LOCK_SH | LOCK_NB) != 0 && errno == EWOULDBLOCK;
    if (descriptor >= 0) close(descriptor);
    return excluded;
}
- (void)updater:(SPUUpdater *)updater willInstallUpdate:(SUAppcastItem *)item { [self record:@"installing" fields:@{}]; }
- (void)updaterWillRelaunchApplication:(SPUUpdater *)updater {
    [self record:@"relaunch" fields:@{}];
    if ([NSBundle.mainBundle.infoDictionary[@"LabScenario"] isEqualToString:@"authorized-channel-loss"]) {
        // Inject transport failure at the real pinned SDK connection, while
        // keeping the host alive. This is a lab control, not a production API.
        id object = updater;
        for (NSString *name in @[@"_driver", @"_uiDriver", @"_coreDriver", @"_installerDriver", @"_installerConnection", @"_connection"]) {
            Ivar ivar = class_getInstanceVariable([object class], name.UTF8String);
            if (ivar == NULL) [NSException raise:@"MissingLabConnection" format:@"%@ on %@", name, [object class]];
            object = object_getIvar(object, ivar);
        }
        if (![object isKindOfClass:NSXPCConnection.class]) [NSException raise:@"InvalidLabConnection" format:@"%@", object];
        [(NSXPCConnection *)object invalidate];
        [self record:@"channelInvalidated" fields:@{}];
        return;
    }
    if (self.hostControlsInstallation) [NSApp terminate:nil];
}
- (void)showUpdatePermissionRequest:(SPUUpdatePermissionRequest *)request reply:(void (^)(SUUpdatePermissionResponse *))reply { reply([[SUUpdatePermissionResponse alloc] initWithAutomaticUpdateChecks:YES sendSystemProfile:NO]); }
- (void)showUserInitiatedUpdateCheckWithCancellation:(void (^)(void))cancellation {}
- (void)showUpdateFoundWithAppcastItem:(SUAppcastItem *)item state:(SPUUserUpdateState *)state reply:(void (^)(SPUUserUpdateChoice))reply { [self record:@"found" fields:@{@"stage":@(state.stage)}]; reply(SPUUserUpdateChoiceInstall); }
- (void)showUpdateReleaseNotesWithDownloadData:(SPUDownloadData *)data {}
- (void)showUpdateReleaseNotesFailedToDownloadWithError:(NSError *)error {}
- (void)showUpdateNotFoundWithError:(NSError *)error acknowledgement:(void (^)(void))ack { [self record:@"notFound" fields:@{@"message":error.description}]; ack(); }
- (void)showUpdaterError:(NSError *)error acknowledgement:(void (^)(void))ack { [self record:@"error" fields:@{@"message":error.description}]; ack(); }
- (void)showDownloadInitiatedWithCancellation:(void (^)(void))cancellation { [self record:@"download" fields:@{}]; }
- (void)showDownloadDidReceiveExpectedContentLength:(uint64_t)length {}
- (void)showDownloadDidReceiveDataOfLength:(uint64_t)length {}
- (void)showDownloadDidStartExtractingUpdate {
    [self record:@"extract" fields:@{}];
    if ([NSBundle.mainBundle.infoDictionary[@"LabScenario"] isEqualToString:@"disable-extract-quit"]) {
        self.updater.automaticallyChecksForUpdates = NO;
        self.cancelling = YES;
        [NSApp terminate:nil];
    }
}
- (void)showExtractionReceivedProgress:(double)progress {}
- (void)showReadyToInstallAndRelaunch:(void (^)(SPUUserUpdateChoice))reply { self.installReply = reply; [self record:@"ready" fields:@{@"busy":@(self.busy)}]; }
- (void)showInstallingUpdateWithApplicationTerminated:(BOOL)terminated retryTerminatingApplication:(void (^)(void))retry {
    NSString *scenario = NSBundle.mainBundle.infoDictionary[@"LabScenario"];
    if ([scenario isEqualToString:@"stalled-helper-crash"] || [scenario isEqualToString:@"stalled-timeout"]) {
        [self record:@"stalled" fields:@{}];
        raise(SIGSTOP);
    }
    BOOL excluded = [self replacementExcluded];
    [self record:@"installProgress" fields:@{@"terminated":@(terminated), @"replacementExcluded":@(excluded)}];
    if (self.hostControlsInstallation && !self.busy && !self.cancelling && ![scenario isEqualToString:@"unconfirmed-crash"] && ![scenario isEqualToString:@"cancel-install"]) {
        [self record:@"authorizeFinal" fields:@{}];
        retry();
    }
}
- (void)showUpdateInstalledAndRelaunched:(BOOL)relaunched acknowledgement:(void (^)(void))ack { [self record:@"installed" fields:@{@"relaunched":@(relaunched)}]; ack(); }
- (void)dismissUpdateInstallation { [self record:@"dismiss" fields:@{}]; }
@end

int main(int argc, const char *argv[]) {
    @autoreleasepool {
        NSApplication *application = NSApplication.sharedApplication;
        Lab *delegate = [Lab new]; application.delegate = delegate;
        [application setActivationPolicy:NSApplicationActivationPolicyProhibited];
        [application run];
    }
    return 0;
}
