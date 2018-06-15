
#import "RNEstimote.h"

@implementation RNEstimote

const double BACKGROUND_BEACON_DETECT_RANGE = 20;

- (id)init {
    self = [super init];
    return self;
}

- (dispatch_queue_t)methodQueue
{
    return dispatch_get_main_queue();
}

RCT_EXPORT_MODULE()

RCT_EXPORT_METHOD(init:(NSString *)appId withAppToken: (NSString *) appToken withBeaconZones:(NSArray *) detectDistances) {
    EPXCloudCredentials *cloudCredentials =[[EPXCloudCredentials alloc] initWithAppID:appId appToken:appToken];
    self.proximityObserver = [[EPXProximityObserver alloc]
                                        initWithCredentials:cloudCredentials
                                        errorBlock:^(NSError * _Nonnull error) {
                                            NSLog(@"proximity observer error = %@" ,error);
                                        }];

    NSMutableArray * _zones = [[NSMutableArray alloc] init];
    for (NSString* distance in detectDistances) {
        double range = [distance doubleValue];
        if(range == 0) {
            range = 10.0;
        }
        EPXProximityZone *zone = [[EPXProximityZone alloc]
                                  initWithRange:[EPXProximityRange customRangeWithDesiredMeanTriggerDistance: range]
                                  attachmentKey: @"range_ios"
                                  attachmentValue: distance];


        zone.onExitAction = ^(EPXDeviceAttachment * _Nonnull attachment) {
            [self sendEventWithName: @"RNEstimoteEventOnLeave"
                               body:attachment.payload];

            RCTLogWarn(@"on leave: %@", attachment.payload);
        };
        zone.onChangeAction = ^(NSSet<EPXDeviceAttachment *> * _Nonnull attachmentsCurrentlyInside) {
            NSArray *_attachment = [[attachmentsCurrentlyInside valueForKey:@"payload"] allObjects];
            [self sendEventWithName: @"RNEstimoteEventOnEnter"
                               body:_attachment];
            RCTLogWarn(@"%@ beacon: %@", @(attachmentsCurrentlyInside.count), attachmentsCurrentlyInside);
        };
        [_zones addObject:zone];
    }
    self.zones = [[NSArray alloc] init];
    self.zones = [self.zones arrayByAddingObjectsFromArray:_zones];
    [self.proximityObserver startObservingZones: self.zones];
}

RCT_EXPORT_METHOD(start) {
    [self.proximityObserver startObservingZones: self.zones];
}

RCT_EXPORT_METHOD(stop) {
    [self.proximityObserver stopObservingZones];
}

RCT_REMAP_METHOD(isSupportIOSProximityEstimoteSDK,
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
    if ([[NSTimer class] respondsToSelector:@selector(scheduledTimerWithTimeInterval:repeats:block:)]) {
        resolve([NSNumber numberWithBool:YES]);
    } else {
        resolve([NSNumber numberWithBool:NO]);
    }
}


- (NSArray<NSString *> *)supportedEvents {
    return @[@"RNEstimoteEventOnEnter", @"RNEstimoteEventOnLeave"];
}
@end
