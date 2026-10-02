#import <Foundation/Foundation.h>
BOOL CameraReadersObserve(void (^signal)(void), NSError **error);
NSDictionary *CameraReadersFinish(void);
