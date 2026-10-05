#import <AppKit/AppKit.h>
#import <Sparkle/Sparkle.h>

int main(void) {
    @autoreleasepool {
        NSBundle *framework = [NSBundle bundleForClass:SPUUpdater.class];
        NSDictionary *facts = @{
            @"bundleId": NSBundle.mainBundle.bundleIdentifier ?: @"",
            @"version": [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"",
            @"frameworkVersion": [framework objectForInfoDictionaryKey:@"CFBundleShortVersionString"] ?: @"",
        };
        NSData *json = [NSJSONSerialization dataWithJSONObject:facts options:0 error:nil];
        fwrite(json.bytes, 1, json.length, stdout);
        fputc('\n', stdout);
    }
    return 0;
}
