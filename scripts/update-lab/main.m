#import <Cocoa/Cocoa.h>
#import <Sparkle/Sparkle.h>

@interface Lab : NSObject <NSApplicationDelegate, SPUUpdaterDelegate, SPUUserDriver>
@property SPUUpdater *updater;
@property NSString *root;
@property NSString *version;
@property NSTimer *commands;
@property(copy) void (^installReply)(SPUUserUpdateChoice);
@property BOOL busy;
@property BOOL cancelling;
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
    self.root = NSProcessInfo.processInfo.environment[@"SCREENREC_UPDATE_LAB"] ?: NSBundle.mainBundle.infoDictionary[@"LabRoot"];
    self.version = NSBundle.mainBundle.infoDictionary[@"CFBundleVersion"];
    self.busy = YES;
    [self record:@"launch" fields:@{@"arguments":NSProcessInfo.processInfo.arguments, @"environmentPreserved":@(NSProcessInfo.processInfo.environment[@"SCREENREC_UPDATE_LAB"] != nil)}];
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
    else if ([command isEqualToString:@"install"]) { self.busy = NO; if (self.installReply) { void (^reply)(SPUUserUpdateChoice) = self.installReply; self.installReply = nil; reply(SPUUserUpdateChoiceInstall); } }
    else if ([command isEqualToString:@"disable"]) { self.updater.automaticallyChecksForUpdates = NO; self.cancelling = YES; if (self.installReply) { void (^reply)(SPUUserUpdateChoice) = self.installReply; self.installReply = nil; reply(SPUUserUpdateChoiceSkip); } }
    else if ([command isEqualToString:@"quit"]) [NSApp terminate:nil];
}
- (NSApplicationTerminateReply)applicationShouldTerminate:(NSApplication *)sender {
    [self record:@"terminate" fields:@{@"busy":@(self.busy),@"cancelling":@(self.cancelling)}];
    return NSTerminateNow;
}
- (BOOL)updater:(SPUUpdater *)updater shouldProceedWithUpdate:(SUAppcastItem *)item updateCheck:(SPUUpdateCheck)check error:(NSError **)error {
    NSString *format = item.propertiesDictionary[@"screenrecCatalogFormat"];
    BOOL accepted = item.signingValidationStatus == SPUAppcastSigningValidationStatusSucceeded && [format isEqualToString:@"23"];
    [self record:@"candidate" fields:@{@"candidateVersion":item.versionString,@"format":format ?: @"missing",@"accepted":@(accepted),@"signatureStatus":@(item.signingValidationStatus)}];
    if (!accepted && error != NULL) *error = [NSError errorWithDomain:@"ScreenrecUpdateLab" code:1 userInfo:@{NSLocalizedDescriptionKey:@"candidate format is incompatible"}];
    return accepted;
}
- (void)updater:(SPUUpdater *)updater didFinishUpdateCycleForUpdateCheck:(SPUUpdateCheck)check error:(NSError *)error {
    [self record:@"cycle" fields:@{@"error":error.description ?: @""}];
}
- (void)updater:(SPUUpdater *)updater willInstallUpdate:(SUAppcastItem *)item { [self record:@"installing" fields:@{}]; }
- (void)updaterWillRelaunchApplication:(SPUUpdater *)updater { [self record:@"relaunch" fields:@{}]; }
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
- (void)showInstallingUpdateWithApplicationTerminated:(BOOL)terminated retryTerminatingApplication:(void (^)(void))retry { [self record:@"installProgress" fields:@{@"terminated":@(terminated)}]; }
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
