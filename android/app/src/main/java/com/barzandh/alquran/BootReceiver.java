package com.barzandh.alquran;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** After a restart, an update or a clock/time-zone change, set the reminder alarms again. */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent i) { Scheduler.apply(c); }
}
