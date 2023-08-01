import {useRef} from 'react';
import styled from '@emotion/styled';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {Overlay} from 'sentry/components/overlay';
import Panel from 'sentry/components/panels/panel';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useRouter from 'sentry/utils/useRouter';
import {CheckInTimeline} from 'sentry/views/monitors/components/overviewTimeline/checkInTimeline';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {ResolutionSelector} from 'sentry/views/monitors/components/overviewTimeline/resolutionSelector';
import {
  MonitorBucketData,
  TimeWindow,
} from 'sentry/views/monitors/components/overviewTimeline/types';
import {timeWindowConfig} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {getTimeRangeFromEvent} from 'sentry/views/monitors/utils/getTimeRangeFromEvent';

interface Props {
  event: Event;
  organization: Organization;
}

const DEFAULT_ENVIRONMENT = 'production';

export function CronTimelineSection({event, organization}: Props) {
  const {location} = useRouter();
  const timeWindow: TimeWindow = location.query?.timeWindow ?? '24h';
  const monitorSlug = event.tags.find(({key}) => key === 'monitor.slug')?.value;
  const environment = event.tags.find(({key}) => key === 'environment')?.value;

  const nowRef = useRef<Date>(new Date());
  const {start, end} = getTimeRangeFromEvent(event, nowRef.current, timeWindow);
  const {elementRef, width: timelineWidth} = useDimensions<HTMLDivElement>();

  const elapsedMinutes = timeWindowConfig[timeWindow].elapsedMinutes;
  const rollup = Math.floor((elapsedMinutes * 60) / timelineWidth);

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(end.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitorSlug,
          resolution: `${rollup}s`,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!monitorSlug && timelineWidth > 0,
    }
  );

  if (!monitorSlug) {
    return null;
  }

  const msPerPixel = (elapsedMinutes * 60 * 1000) / timelineWidth;
  const eventTickLeft =
    (new Date(event.dateReceived).valueOf() - start.valueOf()) / msPerPixel;

  return (
    <EventDataSection
      title={t('Check-ins')}
      type="check-ins"
      help={t('A timeline of check-ins that happened before and after this event')}
    >
      <StyledResolutionSelector />
      <TimelineContainer>
        <TimelineWidthTracker ref={elementRef} />
        <StyledGridLineTimeLabels
          timeWindow={timeWindow}
          end={end}
          width={timelineWidth}
        />
        <StyledGridLineOverlay
          showCursor={!isLoading}
          timeWindow={timeWindow}
          end={end}
          width={timelineWidth}
        />
        <EventLineTick left={eventTickLeft} />
        <EventLineLabel left={eventTickLeft} timelineWidth={timelineWidth}>
          {t('Event Created')}
        </EventLineLabel>
        {monitorStats && !isLoading ? (
          <CheckInTimeline
            width={timelineWidth}
            bucketedData={monitorStats[monitorSlug]}
            start={start}
            end={end}
            timeWindow={timeWindow}
            environment={environment ?? DEFAULT_ENVIRONMENT}
          />
        ) : (
          <Placeholder />
        )}
      </TimelineContainer>
    </EventDataSection>
  );
}

const StyledResolutionSelector = styled(ResolutionSelector)`
  margin-bottom: ${space(1)};
`;

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: 40px 100px;
  align-items: center;
`;

const StyledGridLineTimeLabels = styled(GridLineTimeLabels)`
  grid-column: 0;
`;

const StyledGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 0;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 0;
`;

const EventLineTick = styled('div')<{left: number}>`
  background: ${p => p.theme.translucentBorder};
  width: 2px;
  height: 100%;
  grid-row: 2 / 3;
  position: absolute;
  top: 0;
  left: ${p => p.left}px;
  transform: translateX(-2px);
`;

const EventLineLabel = styled(Overlay)<{left: number; timelineWidth: number}>`
  width: max-content;
  padding: ${space(0.75)} ${space(1)};
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeSmall};
  position: absolute;
  bottom: ${space(1)};
  left: clamp(0px, ${p => p.left}px, calc(${p => p.timelineWidth}px - 50px));
  transform: translateX(-50%);
`;