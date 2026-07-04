from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Question, UserTechnologyProgress

@receiver(post_save, sender=Question)
def update_total_questions_on_new_question(sender, instance, created, **kwargs):
    """
    Jab bhi naya question add hota hai, uski technology ke sabhi users ka
    total question count update kar do.
    """
    if not created:
        return  # sirf naya question par chalega

    technology = instance.technology
    if not technology:
        return

    user_progress_records = UserTechnologyProgress.objects.filter(technology=technology)

    for progress in user_progress_records:
        progress.total = technology.questions.count()
        progress.save(update_fields=["total"])

    print(f"✅ Updated total questions for {user_progress_records.count()} users in '{technology.name}'")
