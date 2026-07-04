from core.models import User
import django_filters

class CandidateFilter(django_filters.FilterSet):
    joined_from = django_filters.DateFilter(field_name="date_joined", lookup_expr="gte")
    joined_to = django_filters.DateFilter(field_name="date_joined", lookup_expr="lte")
    profile = django_filters.CharFilter(lookup_expr="icontains")
    technology = django_filters.CharFilter(method="filter_by_technology")

    class Meta:
        model = User
        fields = ["profile"]

    def filter_by_technology(self, queryset, name, value):
        return queryset.filter(assignments__technology__name__icontains=value)
