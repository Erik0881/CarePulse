'use server'

import { ID, Query } from "node-appwrite";
import { APPOINTMENT_COLLECTION_ID, DATABASE_ID, databases, messaging } from "../appwrite.config";
import { formatDateTime, parseStringify } from "../utils";
import { scheduler } from "timers/promises";
import { Cancel } from "@radix-ui/react-alert-dialog";
import { Appointment } from "@/types/appwrite.types";
import AppointmentForm from "@/components/forms/AppointmentForm";
import { revalidatePath } from "next/cache";

export const createAppointment = async (appoinment: CreateAppointmentParams) => {
  try {
    const newAppointment = await databases.createDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      ID.unique(),
      appoinment
    );
  
    return parseStringify(newAppointment);
  } catch (error) {
    console.log(error);
  }
}

// GET APPOINTMENT
export const getAppointment = async (appointmentId: string) => {
  try {
    const appointment = await databases.getDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId,
    );

    return parseStringify(appointment);
  } catch (error) {
    console.error(error);
  }
};

//  GET RECENT APPOINTMENTS
export const getRecentAppointmentList = async () => {
  try {
    const appoinments = await databases.listDocuments(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      [Query.orderDesc('$createdAt')]
    );

    const  initialCounts = {
      scheduledCount: 0,
      pendingCount: 0,
      cancelledCount: 0,
    }

    const counts = (appoinments.documents as Appointment[]).reduce((acc, appointment) => {
      if (appointment.status === 'scheduled') {
        acc.scheduledCount += 1;
      } else if (appointment.status === 'pending') {
        acc.pendingCount += 1;
      } else if (appointment.status === 'cancelled') {
        acc.cancelledCount += 1;
      }
      return acc;
    }, initialCounts);
    
    const data = {
      totalCount: appoinments.total,
      ...counts,
      documents: appoinments.documents
    }

    return parseStringify(data);
  } catch (error) {
    console.log(error)
  }
}

export const updateAppointment = async ({
  appointmentId,
  userId,
  appointment,
  type,
}: UpdateAppointmentParams) => {
  try {
    const updateAppointment = await databases.updateDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId,
      appointment
    )

    if(!updateAppointment) {
      throw new Error('Appointmen not found');
    }

    const smsMessage = `
    Hi, it's CarePulse.
        ${type === 'schedule'
          ? `Your appointment has been scheduled for ${formatDateTime(appointment.schedule!).dateTime} with Dr. ${appointment.primaryPhysician}.`
          : `We regret to inform you that your appointment has been cancelled for the following reason: ${appointment.cancellationReason}`
        }
    `
    await sendSMSNotification(userId, smsMessage);

    revalidatePath('/admin');
    return parseStringify(updateAppointment)
  } catch (error) {
    console.log(error)
  }
};

export const sendSMSNotification = async (userId: string,content: string) => {
  try {
    const message = await messaging.createSms(
      ID.unique(),
      content,
      [],
      [userId]
    )

    return parseStringify(message);
  } catch (error) {
    console.log(error)
  }
}
